use std::path::Path;

use super::super::AgentUsageStatus;
use super::parsers::parse_opencode_message;
use super::{opencode_models_context_window, status_with_model_window};

pub(super) fn scan(
    home: &Path,
    cwd: &str,
    session_title_hint: Option<&str>,
    session_started_at_ms: Option<u64>,
) -> Option<AgentUsageStatus> {
    // The session.tokens_* columns are cumulative across every turn and
    // must NOT be used; active context comes from the latest assistant
    // message (see docs/OPENCODE_CONTEXT_WINDOW.md).
    let connection = rusqlite::Connection::open_with_flags(
        home.join(".local/share/opencode/opencode.db"),
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .ok()?;
    let directory = cwd.trim_end_matches('/');
    let session_id: String = match (
        session_title_hint.filter(|hint| super::is_session_title_hint(hint)),
        session_started_at_ms,
    ) {
        (Some(hint), _) => connection
            .query_row(
                "SELECT id FROM session WHERE directory = ?1 AND title = ?2 LIMIT 1",
                [directory, hint],
                |row| row.get(0),
            )
            .ok()?,
        (None, Some(started_at_ms)) => connection
            .query_row(
                "SELECT id FROM session WHERE directory = ?1 ORDER BY ABS(time_created - ?2) LIMIT 1",
                rusqlite::params![directory, started_at_ms],
                |row| row.get(0),
            )
            .ok()?,
        (None, None) => connection
            .query_row(
                "SELECT id FROM session WHERE directory = ?1 ORDER BY time_updated DESC LIMIT 1",
                [directory],
                |row| row.get(0),
            )
            .ok()?,
    };
    scan_session_messages(home, &connection, &session_id)
}

pub(super) fn scan_exact(home: &Path, native_session_id: &str) -> Option<AgentUsageStatus> {
    let connection = rusqlite::Connection::open_with_flags(
        home.join(".local/share/opencode/opencode.db"),
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .ok()?;
    scan_session_messages(home, &connection, native_session_id)
}

fn scan_session_messages(
    home: &Path,
    connection: &rusqlite::Connection,
    session_id: &str,
) -> Option<AgentUsageStatus> {
    let mut statement = connection
        .prepare(
            "SELECT data FROM message WHERE session_id = ?1 ORDER BY time_created DESC LIMIT 50",
        )
        .ok()?;
    let rows = statement
        .query_map([session_id], |row| row.get::<_, String>(0))
        .ok()?;
    let (tokens, provider, model) = rows
        .flatten()
        .find_map(|data| parse_opencode_message(&data))?;
    let window = opencode_models_context_window(home, Some(&provider), &model);
    let mut status = status_with_model_window("opencode", tokens, &model, window);
    status.native_session_id = Some(session_id.to_string());
    Some(status)
}
