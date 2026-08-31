use rusqlite::{Connection, OpenFlags};

use super::{ImportableAgentSession, PROVIDER_LIMIT};

pub fn list_sessions(db_path: &std::path::Path) -> Vec<ImportableAgentSession> {
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
