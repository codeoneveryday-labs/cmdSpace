use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use serde_json::Value;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const PROVIDER_LIMIT: usize = 50;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportableAgentSession {
    provider: &'static str,
    session_id: String,
    cwd: String,
    title: String,
    preview: Option<String>,
    last_activity_at: u64,
    active: bool,
}

pub fn list_agent_sessions(limit: Option<usize>) -> Result<Vec<ImportableAgentSession>, String> {
    let home = dirs::home_dir().ok_or_else(|| "could not resolve home directory".to_string())?;
    Ok(list_agent_sessions_in(
        &home,
        limit.unwrap_or(100).clamp(1, 500),
    ))
}

fn list_agent_sessions_in(home: &Path, limit: usize) -> Vec<ImportableAgentSession> {
    let mut sessions = Vec::new();
    sessions.extend(list_jsonl_sessions(
        "claude",
        &home.join(".claude/projects"),
        parse_claude_session,
    ));
    sessions.extend(list_jsonl_sessions(
        "codex",
        &home.join(".codex/sessions"),
        parse_codex_session,
    ));
    sessions.extend(list_jsonl_sessions(
        "pi",
        &home.join(".pi/agent/sessions"),
        parse_pi_session,
    ));
    sessions.extend(list_opencode_sessions(
        &home.join(".local/share/opencode/opencode.db"),
    ));
    sessions.sort_by(|left, right| right.last_activity_at.cmp(&left.last_activity_at));
    sessions.truncate(limit);
    sessions
}

fn list_jsonl_sessions(
    provider: &'static str,
    root: &Path,
    parse: fn(&Path, u64) -> Option<ImportableAgentSession>,
) -> Vec<ImportableAgentSession> {
    let mut files = Vec::new();
    collect_jsonl_files(root, &mut files);
    files.sort_by_key(|path| std::cmp::Reverse(file_mtime_ms(path)));
    files
        .into_iter()
        .take(PROVIDER_LIMIT * 4)
        .filter_map(|path| parse(&path, file_mtime_ms(&path)))
        .filter(|session| session.provider == provider)
        .take(PROVIDER_LIMIT)
        .collect()
}

fn collect_jsonl_files(root: &Path, files: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_dir() {
            collect_jsonl_files(&path, files);
        } else if file_type.is_file() && path.extension().is_some_and(|ext| ext == "jsonl") {
            files.push(path);
        }
    }
}

fn file_mtime_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn jsonl_values(path: &Path) -> impl Iterator<Item = Value> {
    File::open(path)
        .ok()
        .into_iter()
        .flat_map(|file| BufReader::new(file).lines().map_while(Result::ok))
        .filter_map(|line| serde_json::from_str(&line).ok())
}

fn string_field<'a>(value: &'a Value, field: &str) -> Option<&'a str> {
    value
        .get(field)?
        .as_str()
        .filter(|value| !value.trim().is_empty())
}

fn preview_text(value: &Value) -> Option<String> {
    let content = value.get("message")?.get("content")?;
    if let Some(text) = content.as_str() {
        return non_empty_preview(text);
    }
    content.as_array()?.iter().find_map(|part| {
        (part.get("type").and_then(Value::as_str) == Some("text"))
            .then(|| part.get("text").and_then(Value::as_str))
            .flatten()
            .and_then(non_empty_preview)
    })
}

fn non_empty_preview(text: &str) -> Option<String> {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() {
        None
    } else {
        Some(collapsed.chars().take(160).collect())
    }
}

fn fallback_title(provider: &str, session_id: &str) -> String {
    format!(
        "{} session {}",
        provider,
        session_id.chars().take(8).collect::<String>()
    )
}

fn codex_session_is_active(home: &Path, session_id: &str) -> bool {
    let lock_path = home
        .join(".codex/thread-writer-locks")
        .join(format!("{session_id}.lock"));
    let Ok(lock) = File::options().read(true).write(true).open(lock_path) else {
        return false;
    };
    match lock.try_lock() {
        Ok(()) => {
            let _ = lock.unlock();
            false
        }
        Err(std::fs::TryLockError::WouldBlock) => true,
        Err(_) => false,
    }
}

fn parse_claude_session(path: &Path, mtime: u64) -> Option<ImportableAgentSession> {
    let mut session_id = None;
    let mut cwd = None;
    let mut preview = None;
    for entry in jsonl_values(path) {
        session_id = session_id.or_else(|| string_field(&entry, "sessionId").map(str::to_owned));
        cwd = cwd.or_else(|| string_field(&entry, "cwd").map(str::to_owned));
        if preview.is_none() && string_field(&entry, "type") == Some("user") {
            preview = preview_text(&entry);
        }
        if session_id.is_some() && cwd.is_some() && preview.is_some() {
            break;
        }
    }
    let session_id = session_id?;
    Some(ImportableAgentSession {
        provider: "claude",
        cwd: cwd?,
        title: preview
            .clone()
            .unwrap_or_else(|| fallback_title("Claude", &session_id)),
        preview,
        session_id,
        last_activity_at: mtime,
        active: false,
    })
}

fn parse_codex_session(path: &Path, mtime: u64) -> Option<ImportableAgentSession> {
    let mut session_id = None;
    let mut cwd = None;
    let mut preview = None;
    for entry in jsonl_values(path) {
        if string_field(&entry, "type") == Some("session_meta") {
            let payload = entry.get("payload")?;
            session_id = session_id.or_else(|| string_field(payload, "id").map(str::to_owned));
            cwd = cwd.or_else(|| string_field(payload, "cwd").map(str::to_owned));
        } else if string_field(&entry, "type") == Some("event_msg") {
            let payload = entry.get("payload")?;
            if preview.is_none() && string_field(payload, "type") == Some("user_message") {
                preview = string_field(payload, "message").and_then(non_empty_preview);
            }
        }
        if session_id.is_some() && cwd.is_some() && preview.is_some() {
            break;
        }
    }
    let session_id = session_id?;
    let active = path
        .ancestors()
        .find(|ancestor| ancestor.file_name().is_some_and(|name| name == ".codex"))
        .and_then(Path::parent)
        .is_some_and(|home| codex_session_is_active(home, &session_id));
    Some(ImportableAgentSession {
        provider: "codex",
        cwd: cwd?,
        title: preview
            .clone()
            .unwrap_or_else(|| fallback_title("Codex", &session_id)),
        preview,
        active,
        session_id,
        last_activity_at: mtime,
    })
}

fn parse_pi_session(path: &Path, mtime: u64) -> Option<ImportableAgentSession> {
    let mut values = jsonl_values(path);
    let header = values.next()?;
    if string_field(&header, "type") != Some("session") {
        return None;
    }
    let cwd = string_field(&header, "cwd")?.to_owned();
    let mut title = None;
    let mut preview = None;
    for entry in values {
        if title.is_none() && string_field(&entry, "type") == Some("session_info") {
            title = string_field(&entry, "name").map(str::to_owned);
        }
        if preview.is_none()
            && string_field(&entry, "type") == Some("message")
            && entry.get("message")?.get("role").and_then(Value::as_str) == Some("user")
        {
            let content = entry.get("message")?.get("content")?;
            preview = content.as_str().and_then(non_empty_preview).or_else(|| {
                content.as_array()?.iter().find_map(|part| {
                    part.get("text")
                        .and_then(Value::as_str)
                        .and_then(non_empty_preview)
                })
            });
        }
        if title.is_some() && preview.is_some() {
            break;
        }
    }
    let session_id = path.to_string_lossy().into_owned();
    Some(ImportableAgentSession {
        provider: "pi",
        cwd,
        title: title
            .or_else(|| preview.clone())
            .unwrap_or_else(|| fallback_title("Pi", &session_id)),
        preview,
        session_id,
        last_activity_at: mtime,
        active: false,
    })
}

fn list_opencode_sessions(db_path: &Path) -> Vec<ImportableAgentSession> {
    let Ok(connection) = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
    else {
        return Vec::new();
    };
    let Ok(mut statement) = connection.prepare(
        "SELECT id, directory, title, time_updated FROM session \
         WHERE time_archived IS NULL ORDER BY time_updated DESC LIMIT ?1",
    ) else {
        return Vec::new();
    };
    let Ok(rows) = statement.query_map([PROVIDER_LIMIT as i64], |row| {
        Ok(ImportableAgentSession {
            provider: "opencode",
            session_id: row.get(0)?,
            cwd: row.get(1)?,
            title: row.get(2)?,
            preview: None,
            last_activity_at: row.get::<_, i64>(3)?.max(0) as u64,
            active: false,
        })
    }) else {
        return Vec::new();
    };
    rows.filter_map(Result::ok).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn discovers_native_session_metadata_without_hydrating_history() {
        let home = tempfile::tempdir().unwrap();
        let claude_dir = home.path().join(".claude/projects/repo");
        let codex_dir = home.path().join(".codex/sessions/2026/08/09");
        let pi_dir = home.path().join(".pi/agent/sessions/repo");
        fs::create_dir_all(&claude_dir).unwrap();
        fs::create_dir_all(&codex_dir).unwrap();
        fs::create_dir_all(&pi_dir).unwrap();
        let opencode_dir = home.path().join(".local/share/opencode");
        fs::create_dir_all(&opencode_dir).unwrap();

        writeln!(
            File::create(claude_dir.join("claude-id.jsonl")).unwrap(),
            "{}",
            serde_json::json!({
                "type": "user",
                "sessionId": "claude-id",
                "cwd": "/repo",
                "message": {"content": [{"type": "text", "text": "Fix the terminal"}]}
            })
        )
        .unwrap();
        writeln!(
            File::create(codex_dir.join("rollout.jsonl")).unwrap(),
            "{}",
            serde_json::json!({
                "type": "session_meta",
                "payload": {"id": "codex-id", "cwd": "/repo"}
            })
        )
        .unwrap();
        let pi_path = pi_dir.join("pi-id.jsonl");
        let mut pi = File::create(&pi_path).unwrap();
        writeln!(
            pi,
            "{}",
            serde_json::json!({"type": "session", "id": "pi-id", "cwd": "/repo"})
        )
        .unwrap();
        writeln!(
            pi,
            "{}",
            serde_json::json!({"type": "session_info", "name": "Pi title"})
        )
        .unwrap();

        let opencode_db = Connection::open(opencode_dir.join("opencode.db")).unwrap();
        opencode_db
            .execute_batch(
                "CREATE TABLE session (
                    id TEXT PRIMARY KEY,
                    directory TEXT NOT NULL,
                    title TEXT NOT NULL,
                    time_updated INTEGER NOT NULL,
                    time_archived INTEGER
                );
                INSERT INTO session VALUES ('opencode-id', '/repo', 'OpenCode title', 42, NULL);",
            )
            .unwrap();
        drop(opencode_db);

        let sessions = list_agent_sessions_in(home.path(), 20);
        assert_eq!(sessions.len(), 4);
        assert!(sessions.iter().any(
            |session| session.session_id == "claude-id" && session.title == "Fix the terminal"
        ));
        assert!(sessions
            .iter()
            .any(|session| session.session_id == "codex-id"));
        assert!(sessions
            .iter()
            .any(|session| session.session_id == pi_path.to_string_lossy()
                && session.title == "Pi title"));
        assert!(sessions.iter().any(
            |session| session.session_id == "opencode-id" && session.title == "OpenCode title"
        ));
    }

    #[test]
    fn reports_codex_session_with_held_writer_lock_as_active() {
        let home = tempfile::tempdir().unwrap();
        let lock_dir = home.path().join(".codex/thread-writer-locks");
        fs::create_dir_all(&lock_dir).unwrap();
        let lock = File::create(lock_dir.join("codex-id.lock")).unwrap();
        lock.lock().unwrap();

        assert!(codex_session_is_active(home.path(), "codex-id"));
    }

    #[test]
    fn discovered_codex_session_inherits_active_writer_state() {
        let home = tempfile::tempdir().unwrap();
        let session_dir = home.path().join(".codex/sessions/2026/08/09");
        let lock_dir = home.path().join(".codex/thread-writer-locks");
        fs::create_dir_all(&session_dir).unwrap();
        fs::create_dir_all(&lock_dir).unwrap();
        writeln!(
            File::create(session_dir.join("rollout.jsonl")).unwrap(),
            "{}",
            serde_json::json!({
                "type": "session_meta",
                "payload": {"id": "codex-id", "cwd": "/repo"}
            })
        )
        .unwrap();
        let lock = File::create(lock_dir.join("codex-id.lock")).unwrap();
        lock.lock().unwrap();

        let sessions = list_agent_sessions_in(home.path(), 20);

        assert!(sessions[0].active);
    }

    #[test]
    fn discovered_codex_session_uses_first_user_message_as_description() {
        let home = tempfile::tempdir().unwrap();
        let session_dir = home.path().join(".codex/sessions/2026/08/09");
        fs::create_dir_all(&session_dir).unwrap();
        let mut session = File::create(session_dir.join("rollout.jsonl")).unwrap();
        writeln!(
            session,
            "{}",
            serde_json::json!({
                "type": "session_meta",
                "payload": {"id": "codex-id", "cwd": "/repo"}
            })
        )
        .unwrap();
        writeln!(
            session,
            "{}",
            serde_json::json!({
                "type": "event_msg",
                "payload": {
                    "type": "user_message",
                    "message": "Fix terminal input duplication"
                }
            })
        )
        .unwrap();

        let sessions = list_agent_sessions_in(home.path(), 20);

        assert_eq!(sessions[0].title, "Fix terminal input duplication");
        assert_eq!(
            sessions[0].preview.as_deref(),
            Some("Fix terminal input duplication")
        );
    }
}
