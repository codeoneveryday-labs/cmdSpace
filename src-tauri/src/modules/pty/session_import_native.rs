use std::fs::File;
use std::path::Path;

use super::ImportableAgentSession;

pub fn codex_session_is_active(home: &Path, session_id: &str) -> bool {
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

pub fn parse_claude_session(path: &Path, mtime: u64) -> Option<ImportableAgentSession> {
    let mut session_id = None;
    let mut cwd = None;
    let mut preview = None;
    for entry in super::jsonl_values(path) {
        session_id =
            session_id.or_else(|| super::string_field(&entry, "sessionId").map(str::to_owned));
        cwd = cwd.or_else(|| super::string_field(&entry, "cwd").map(str::to_owned));
        if preview.is_none() && super::string_field(&entry, "type") == Some("user") {
            preview = super::preview_text(&entry);
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
            .unwrap_or_else(|| super::fallback_title("Claude", &session_id)),
        preview,
        session_id,
        last_activity_at: mtime,
        active: false,
    })
}

pub fn parse_codex_session(path: &Path, mtime: u64) -> Option<ImportableAgentSession> {
    let mut session_id = None;
    let mut cwd = None;
    let mut preview = None;
    for entry in super::jsonl_values(path) {
        if super::string_field(&entry, "type") == Some("session_meta") {
            let payload = entry.get("payload")?;
            session_id =
                session_id.or_else(|| super::string_field(payload, "id").map(str::to_owned));
            cwd = cwd.or_else(|| super::string_field(payload, "cwd").map(str::to_owned));
        } else if super::string_field(&entry, "type") == Some("event_msg") {
            let payload = entry.get("payload")?;
            if preview.is_none() && super::string_field(payload, "type") == Some("user_message") {
                preview =
                    super::string_field(payload, "message").and_then(super::non_empty_preview);
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
            .unwrap_or_else(|| super::fallback_title("Codex", &session_id)),
        preview,
        active,
        session_id,
        last_activity_at: mtime,
    })
}

pub fn parse_pi_session(path: &Path, mtime: u64) -> Option<ImportableAgentSession> {
    let mut values = super::jsonl_values(path);
    let header = values.next()?;
    if super::string_field(&header, "type") != Some("session") {
        return None;
    }
    let cwd = super::string_field(&header, "cwd")?.to_owned();
    let mut title = None;
    let mut preview = None;
    for entry in values {
        if title.is_none() && super::string_field(&entry, "type") == Some("session_info") {
            title = super::string_field(&entry, "name").map(str::to_owned);
        }
        if preview.is_none()
            && super::string_field(&entry, "type") == Some("message")
            && entry
                .get("message")?
                .get("role")
                .and_then(serde_json::Value::as_str)
                == Some("user")
        {
            let content = entry.get("message")?.get("content")?;
            preview = content
                .as_str()
                .and_then(super::non_empty_preview)
                .or_else(|| {
                    content.as_array()?.iter().find_map(|part| {
                        part.get("text")
                            .and_then(serde_json::Value::as_str)
                            .and_then(super::non_empty_preview)
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
            .unwrap_or_else(|| super::fallback_title("Pi", &session_id)),
        preview,
        session_id,
        last_activity_at: mtime,
        active: false,
    })
}
