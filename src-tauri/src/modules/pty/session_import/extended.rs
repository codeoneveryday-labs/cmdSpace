use super::{
    fallback_title, file_mtime_ms, jsonl_values, non_empty_preview, preview_text,
    ImportableAgentSession, PROVIDER_LIMIT,
};
use rusqlite::{Connection, OpenFlags};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

pub(super) fn list_extended_sessions(
    home: &Path,
    workspace_cwd: Option<&Path>,
) -> Vec<ImportableAgentSession> {
    let mut sessions = Vec::new();
    sessions.extend(list_gemini_sessions(home));
    sessions.extend(list_copilot_sessions(home));
    sessions.extend(list_cursor_sessions(home));
    sessions.extend(list_aider_sessions(workspace_cwd));
    sessions.extend(list_cline_sessions(home));
    sessions.extend(list_goose_sessions(home));
    sessions.extend(list_kimi_sessions(home));
    sessions.extend(list_openhands_sessions(home));
    sessions.extend(list_kiro_sessions(home));
    sessions.extend(list_grok_sessions(home));
    sessions.extend(list_command_code_sessions(home));

    let mut seen = HashSet::new();
    sessions.retain(|session| seen.insert((session.provider, session.session_id.clone())));
    sessions
}

fn make_session(
    provider: &'static str,
    session_id: String,
    cwd: String,
    title: Option<String>,
    preview: Option<String>,
    last_activity_at: u64,
) -> ImportableAgentSession {
    ImportableAgentSession {
        provider,
        title: title
            .or_else(|| preview.clone())
            .unwrap_or_else(|| fallback_title(provider, &session_id)),
        preview,
        session_id,
        cwd,
        last_activity_at,
        active: false,
    }
}

fn read_json(path: &Path) -> Option<Value> {
    serde_json::from_reader(fs::File::open(path).ok()?).ok()
}

fn string_at_any_key(value: &Value, keys: &[&str]) -> Option<String> {
    if let Some(object) = value.as_object() {
        for key in keys {
            if let Some(text) = object
                .get(*key)
                .and_then(Value::as_str)
                .and_then(non_empty_preview)
            {
                return Some(text);
            }
        }
        for child in object.values() {
            if let Some(text) = string_at_any_key(child, keys) {
                return Some(text);
            }
        }
    } else if let Some(array) = value.as_array() {
        for child in array {
            if let Some(text) = string_at_any_key(child, keys) {
                return Some(text);
            }
        }
    }
    None
}

fn collect_named_files(root: &Path, names: &[&str], extensions: &[&str]) -> Vec<PathBuf> {
    fn visit(root: &Path, names: &[&str], extensions: &[&str], found: &mut Vec<PathBuf>) {
        let Ok(entries) = fs::read_dir(root) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            if kind.is_dir() {
                visit(&path, names, extensions, found);
            } else if kind.is_file() {
                let name_matches = path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| names.contains(&name));
                let extension_matches = path
                    .extension()
                    .and_then(|extension| extension.to_str())
                    .is_some_and(|extension| extensions.contains(&extension));
                if name_matches || extension_matches {
                    found.push(path);
                }
            }
        }
    }

    let mut found = Vec::new();
    visit(root, names, extensions, &mut found);
    found.sort_by_key(|path| std::cmp::Reverse(file_mtime_ms(path)));
    found.truncate(PROVIDER_LIMIT * 4);
    found
}

fn list_gemini_sessions(home: &Path) -> Vec<ImportableAgentSession> {
    collect_named_files(&home.join(".gemini/tmp"), &[], &["json", "jsonl"])
        .into_iter()
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("session-"))
        })
        .filter_map(|path| {
            let mtime = file_mtime_ms(&path);
            let project_dir = path.parent()?.parent()?;
            let cwd = fs::read_to_string(project_dir.join(".project_root"))
                .ok()?
                .trim()
                .to_owned();
            if cwd.is_empty() {
                return None;
            }
            let values: Vec<Value> = if path.extension().is_some_and(|ext| ext == "jsonl") {
                jsonl_values(&path).take(40).collect()
            } else {
                vec![read_json(&path)?]
            };
            let session_id = values
                .iter()
                .find_map(|value| string_at_any_key(value, &["sessionId"]))?;
            let preview = values
                .iter()
                .find_map(|value| string_at_any_key(value, &["prompt", "text", "content"]));
            Some(make_session(
                "gemini", session_id, cwd, None, preview, mtime,
            ))
        })
        .take(PROVIDER_LIMIT)
        .collect()
}

fn list_copilot_sessions(home: &Path) -> Vec<ImportableAgentSession> {
    let roots = [
        home.join(".copilot/session-state"),
        home.join(".copilot/history-session-state"),
    ];
    roots
        .iter()
        .flat_map(|root| collect_named_files(root, &["events.jsonl"], &[]))
        .filter_map(|path| {
            let session_id = path.parent()?.file_name()?.to_string_lossy().into_owned();
            let values: Vec<Value> = jsonl_values(&path).take(80).collect();
            let cwd = values.iter().find_map(|value| {
                string_at_any_key(
                    value,
                    &["cwd", "workingDirectory", "working_dir", "workDir"],
                )
            })?;
            let preview = values
                .iter()
                .find_map(|value| string_at_any_key(value, &["prompt", "text", "content"]));
            Some(make_session(
                "copilot",
                session_id,
                cwd,
                None,
                preview,
                file_mtime_ms(&path),
            ))
        })
        .take(PROVIDER_LIMIT)
        .collect()
}

fn list_cursor_sessions(home: &Path) -> Vec<ImportableAgentSession> {
    collect_named_files(&home.join(".cursor/chats"), &["meta.json"], &[])
        .into_iter()
        .filter_map(|path| {
            let metadata = read_json(&path)?;
            let session_id = string_at_any_key(&metadata, &["id", "sessionId"])
                .or_else(|| Some(path.parent()?.file_name()?.to_string_lossy().into_owned()))?;
            let cwd = string_at_any_key(&metadata, &["cwd", "workDir", "workingDirectory"])?;
            let title = string_at_any_key(&metadata, &["title", "name"]);
            Some(make_session(
                "cursor",
                session_id,
                cwd,
                title,
                None,
                file_mtime_ms(&path),
            ))
        })
        .take(PROVIDER_LIMIT)
        .collect()
}

fn list_aider_sessions(workspace_cwd: Option<&Path>) -> Vec<ImportableAgentSession> {
    let Some(cwd) = workspace_cwd else {
        return Vec::new();
    };
    let history = cwd.join(".aider.chat.history.md");
    if !history.is_file() {
        return Vec::new();
    }
    let preview = fs::read_to_string(&history)
        .ok()
        .and_then(|text| non_empty_preview(&text));
    vec![make_session(
        "aider",
        history.to_string_lossy().into_owned(),
        cwd.to_string_lossy().into_owned(),
        Some("Aider chat history".to_string()),
        preview,
        file_mtime_ms(&history),
    )]
}

fn list_cline_sessions(home: &Path) -> Vec<ImportableAgentSession> {
    let path = home.join(".cline/data/globalState.json");
    let Some(state) = read_json(&path) else {
        return Vec::new();
    };
    state
        .get("taskHistory")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|task| {
            let session_id = string_at_any_key(task, &["id", "taskId"])?;
            let cwd = string_at_any_key(task, &["cwd", "workspace", "workDir"])?;
            let preview = string_at_any_key(task, &["task", "title", "description"]);
            let timestamp = task
                .get("ts")
                .or_else(|| task.get("updatedAt"))
                .and_then(Value::as_u64)
                .unwrap_or_else(|| file_mtime_ms(&path));
            Some(make_session(
                "cline", session_id, cwd, None, preview, timestamp,
            ))
        })
        .take(PROVIDER_LIMIT)
        .collect()
}

fn list_goose_sessions(home: &Path) -> Vec<ImportableAgentSession> {
    let candidates = [
        home.join(".local/share/goose/sessions/sessions.db"),
        home.join(".local/share/Block/goose/data/sessions/sessions.db"),
        home.join("Library/Application Support/Block/goose/data/sessions/sessions.db"),
        home.join("Library/Application Support/goose/data/sessions/sessions.db"),
        home.join(".config/goose/sessions.db"),
    ];
    candidates
        .iter()
        .find_map(|path| list_goose_db(path))
        .unwrap_or_default()
}

fn list_goose_db(path: &Path) -> Option<Vec<ImportableAgentSession>> {
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).ok()?;
    let mut statement = connection
        .prepare(
            "SELECT id, working_dir, CASE WHEN name != '' THEN name ELSE description END, \
             CAST(strftime('%s', updated_at) AS INTEGER) * 1000 FROM sessions \
             WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT ?1",
        )
        .ok()?;
    let rows = statement
        .query_map([PROVIDER_LIMIT as i64], |row| {
            Ok(make_session(
                "goose",
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                None,
                row.get::<_, i64>(3)?.max(0) as u64,
            ))
        })
        .ok()?;
    Some(rows.filter_map(Result::ok).collect())
}

fn list_kimi_sessions(home: &Path) -> Vec<ImportableAgentSession> {
    [
        home.join(".kimi-code/sessions"),
        home.join(".kimi/sessions"),
    ]
    .iter()
    .flat_map(|root| collect_named_files(root, &["state.json"], &[]))
    .filter_map(|path| {
        let state = read_json(&path)?;
        let session_id = path
            .parent()?
            .file_name()?
            .to_string_lossy()
            .strip_prefix("session_")?
            .to_owned();
        let cwd = string_at_any_key(&state, &["workDir", "cwd", "workingDirectory"])?;
        let title = string_at_any_key(&state, &["title", "name"]);
        Some(make_session(
            "kimi",
            session_id,
            cwd,
            title,
            None,
            file_mtime_ms(&path),
        ))
    })
    .take(PROVIDER_LIMIT)
    .collect()
}

fn list_openhands_sessions(home: &Path) -> Vec<ImportableAgentSession> {
    collect_named_files(
        &home.join(".openhands/conversations"),
        &["conversation.json"],
        &[],
    )
    .into_iter()
    .filter_map(|path| {
        let value = read_json(&path)?;
        let session_id = string_at_any_key(&value, &["conversation_id", "conversationId", "id"])
            .or_else(|| Some(path.parent()?.file_name()?.to_string_lossy().into_owned()))?;
        let cwd = string_at_any_key(&value, &["cwd", "workspace", "working_dir"])?;
        let title = string_at_any_key(&value, &["title", "name"]);
        let preview = string_at_any_key(&value, &["prompt", "text", "content"]);
        Some(make_session(
            "openhands",
            session_id,
            cwd,
            title,
            preview,
            file_mtime_ms(&path),
        ))
    })
    .take(PROVIDER_LIMIT)
    .collect()
}

fn list_kiro_sessions(home: &Path) -> Vec<ImportableAgentSession> {
    collect_named_files(&home.join(".kiro/sessions/cli"), &[], &["json"])
        .into_iter()
        .filter(|path| {
            !path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(".jsonl"))
        })
        .filter_map(|path| {
            let value = read_json(&path)?;
            let session_id = string_at_any_key(&value, &["id", "sessionId"])
                .or_else(|| Some(path.file_stem()?.to_string_lossy().into_owned()))?;
            let cwd = string_at_any_key(&value, &["cwd", "workingDirectory", "workDir"])?;
            let title = string_at_any_key(&value, &["title", "name"]);
            Some(make_session(
                "kiro",
                session_id,
                cwd,
                title,
                None,
                file_mtime_ms(&path),
            ))
        })
        .take(PROVIDER_LIMIT)
        .collect()
}

fn list_grok_sessions(home: &Path) -> Vec<ImportableAgentSession> {
    let path = home.join(".grok/sessions/session_search.sqlite");
    let Ok(connection) = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY)
    else {
        return Vec::new();
    };
    let Ok(mut statement) = connection.prepare(
        "SELECT session_id, cwd, title, updated_at FROM session_docs \
         ORDER BY updated_at DESC LIMIT ?1",
    ) else {
        return Vec::new();
    };
    let Ok(rows) = statement.query_map([PROVIDER_LIMIT as i64], |row| {
        Ok(make_session(
            "grok",
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            None,
            row.get::<_, i64>(3)?.max(0) as u64,
        ))
    }) else {
        return Vec::new();
    };
    rows.filter_map(Result::ok).collect()
}

fn list_command_code_sessions(home: &Path) -> Vec<ImportableAgentSession> {
    collect_named_files(&home.join(".commandcode/projects"), &[], &["jsonl"])
        .into_iter()
        .filter(|path| {
            !path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(".checkpoints.jsonl"))
        })
        .filter_map(|path| {
            let mut values = jsonl_values(&path);
            let header = values.next()?;
            if header.get("type").and_then(Value::as_str) != Some("session") {
                return None;
            }
            let cwd = string_at_any_key(&header, &["cwd"])?;
            let preview = values.find_map(|value| {
                (value.get("type").and_then(Value::as_str) == Some("message")
                    && value
                        .get("message")
                        .and_then(|message| message.get("role"))
                        .and_then(Value::as_str)
                        == Some("user"))
                .then(|| preview_text(&value))
                .flatten()
            });
            let title = read_json(&path.with_extension("meta.json"))
                .and_then(|value| string_at_any_key(&value, &["title", "name"]));
            Some(make_session(
                "cmd",
                path.to_string_lossy().into_owned(),
                cwd,
                title,
                preview,
                file_mtime_ms(&path),
            ))
        })
        .take(PROVIDER_LIMIT)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn discovers_every_local_extended_provider() {
        let home = tempfile::tempdir().unwrap();
        let workspace = home.path().join("repo");
        fs::create_dir_all(&workspace).unwrap();

        let gemini = home.path().join(".gemini/tmp/project/chats");
        fs::create_dir_all(&gemini).unwrap();
        fs::write(
            gemini.parent().unwrap().join(".project_root"),
            workspace.to_string_lossy().as_bytes(),
        )
        .unwrap();
        fs::write(
            gemini.join("session-gemini.json"),
            serde_json::json!({
                "sessionId": "gemini-1",
                "messages": [{"type": "user", "content": "Gemini task"}]
            })
            .to_string(),
        )
        .unwrap();

        let copilot = home.path().join(".copilot/session-state/copilot-1");
        fs::create_dir_all(&copilot).unwrap();
        writeln!(
            fs::File::create(copilot.join("events.jsonl")).unwrap(),
            "{}",
            serde_json::json!({"cwd": workspace, "prompt": "Copilot task"})
        )
        .unwrap();

        let cursor = home.path().join(".cursor/chats/project/cursor-1");
        fs::create_dir_all(&cursor).unwrap();
        fs::write(
            cursor.join("meta.json"),
            serde_json::json!({"cwd": workspace, "title": "Cursor task"}).to_string(),
        )
        .unwrap();

        fs::write(workspace.join(".aider.chat.history.md"), "Aider task").unwrap();

        let cline = home.path().join(".cline/data");
        fs::create_dir_all(&cline).unwrap();
        fs::write(
            cline.join("globalState.json"),
            serde_json::json!({
                "taskHistory": [{"id": "cline-1", "ts": 42, "task": "Cline task", "cwd": workspace}]
            })
            .to_string(),
        )
        .unwrap();

        let goose = home.path().join(".local/share/goose/sessions");
        fs::create_dir_all(&goose).unwrap();
        let goose_db = Connection::open(goose.join("sessions.db")).unwrap();
        goose_db
            .execute_batch(
                "CREATE TABLE sessions (
                id TEXT, name TEXT, description TEXT, working_dir TEXT,
                updated_at TEXT, archived_at TEXT
            );
            INSERT INTO sessions VALUES
                ('goose-1', 'Goose task', '', '/repo', '2026-08-09 00:00:00', NULL);",
            )
            .unwrap();
        drop(goose_db);

        let kimi = home
            .path()
            .join(".kimi-code/sessions/project/session_kimi-1");
        fs::create_dir_all(&kimi).unwrap();
        fs::write(
            kimi.join("state.json"),
            serde_json::json!({"workDir": workspace, "title": "Kimi task"}).to_string(),
        )
        .unwrap();

        let openhands = home.path().join(".openhands/conversations/openhands-1");
        fs::create_dir_all(&openhands).unwrap();
        fs::write(
            openhands.join("conversation.json"),
            serde_json::json!({"workspace": workspace, "title": "OpenHands task"}).to_string(),
        )
        .unwrap();

        let kiro = home.path().join(".kiro/sessions/cli");
        fs::create_dir_all(&kiro).unwrap();
        fs::write(
            kiro.join("kiro-1.json"),
            serde_json::json!({"cwd": workspace, "title": "Kiro task"}).to_string(),
        )
        .unwrap();

        let grok = home.path().join(".grok/sessions");
        fs::create_dir_all(&grok).unwrap();
        let grok_db = Connection::open(grok.join("session_search.sqlite")).unwrap();
        grok_db
            .execute_batch(
                "CREATE TABLE session_docs (
                session_id TEXT, cwd TEXT, title TEXT, updated_at INTEGER
            );
            INSERT INTO session_docs VALUES ('grok-1', '/repo', 'Grok task', 42);",
            )
            .unwrap();
        drop(grok_db);

        let command_code = home.path().join(".commandcode/projects/repo");
        fs::create_dir_all(&command_code).unwrap();
        let mut transcript = fs::File::create(command_code.join("cmd-1.jsonl")).unwrap();
        writeln!(
            transcript,
            "{}",
            serde_json::json!({"type": "session", "id": "cmd-1", "cwd": workspace})
        )
        .unwrap();
        writeln!(
            transcript,
            "{}",
            serde_json::json!({
                "type": "message",
                "message": {"role": "user", "content": [{"type": "text", "text": "Command task"}]}
            })
        )
        .unwrap();

        let sessions = list_extended_sessions(home.path(), Some(&workspace));
        let providers: HashSet<&str> = sessions.iter().map(|session| session.provider).collect();

        assert_eq!(
            providers,
            HashSet::from([
                "gemini",
                "copilot",
                "cursor",
                "aider",
                "cline",
                "goose",
                "kimi",
                "openhands",
                "kiro",
                "grok",
                "cmd"
            ])
        );
    }
}
