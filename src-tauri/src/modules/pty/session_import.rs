use serde::Serialize;
use std::path::Path;

mod extended;
#[path = "session_import_native.rs"]
mod native;
#[path = "session_import_normalization.rs"]
mod normalization;
#[path = "session_import_opencode.rs"]
mod opencode;
#[path = "session_import_scan.rs"]
mod scan;
pub(super) use native::{parse_claude_session, parse_codex_session, parse_pi_session};
pub(super) use normalization::{fallback_title, non_empty_preview, preview_text, string_field};
pub(super) use scan::{file_mtime_ms, jsonl_values};

pub(super) const PROVIDER_LIMIT: usize = 50;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportableAgentSession {
    pub(crate) provider: &'static str,
    pub(crate) session_id: String,
    pub(crate) cwd: String,
    pub(crate) title: String,
    pub(crate) preview: Option<String>,
    pub(crate) last_activity_at: u64,
    pub(crate) active: bool,
}

pub fn list_agent_sessions(
    limit: Option<usize>,
    workspace_cwd: Option<String>,
) -> Result<Vec<ImportableAgentSession>, String> {
    let home = dirs::home_dir().ok_or_else(|| "could not resolve home directory".to_string())?;
    Ok(scan::list_agent_sessions_in(
        &home,
        workspace_cwd.as_deref().map(Path::new),
        limit.unwrap_or(100).clamp(1, 500),
    ))
}

pub(super) use opencode::list_sessions as list_opencode_sessions;

#[cfg(test)]
mod tests {
    use super::native::codex_session_is_active;
    use super::scan::list_agent_sessions_in;
    use rusqlite::Connection;
    use std::fs::{self, File};
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

        let sessions = list_agent_sessions_in(home.path(), None, 20);
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

        let sessions = list_agent_sessions_in(home.path(), None, 20);

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

        let sessions = list_agent_sessions_in(home.path(), None, 20);

        assert_eq!(sessions[0].title, "Fix terminal input duplication");
        assert_eq!(
            sessions[0].preview.as_deref(),
            Some("Fix terminal input duplication")
        );
    }
}
