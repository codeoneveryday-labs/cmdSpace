use rusqlite::{Connection, OpenFlags};

use super::super::{AgentSessionUsage, ProviderLimitStatus};

pub(super) fn scan(home: &std::path::Path) -> Option<ProviderLimitStatus> {
    let path = home.join(".local/share/opencode/opencode.db");
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).ok()?;
    let (input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, updated_at):
        (u64, u64, u64, u64, f64, u64) = connection
        .query_row(
            "SELECT tokens_input, tokens_output, tokens_cache_read, tokens_cache_write, cost, time_updated
             FROM session ORDER BY time_updated DESC LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
        )
        .ok()?;
    let session_usage = AgentSessionUsage {
        input_tokens,
        output_tokens,
        cache_read_tokens,
        cache_write_tokens,
        cost_usd: (cost_usd > 0.0).then_some(cost_usd),
    };
    Some(ProviderLimitStatus {
        provider: "opencode".to_string(),
        rate_limits: Vec::new(),
        session_usage: Some(session_usage),
        account_usage: None,
        observed_at: updated_at / 1000,
    })
}

#[cfg(test)]
mod tests {
    use super::scan;
    use rusqlite::Connection;

    #[test]
    fn reads_the_latest_opencode_session_usage() {
        let home = tempfile::tempdir().unwrap();
        let db_dir = home.path().join(".local/share/opencode");
        std::fs::create_dir_all(&db_dir).unwrap();
        let connection = Connection::open(db_dir.join("opencode.db")).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE session (
                    tokens_input INTEGER NOT NULL,
                    tokens_output INTEGER NOT NULL,
                    tokens_cache_read INTEGER NOT NULL,
                    tokens_cache_write INTEGER NOT NULL,
                    cost REAL NOT NULL,
                    time_updated INTEGER NOT NULL
                );
                INSERT INTO session VALUES (10, 4, 2, 1, 0.25, 1234000);",
            )
            .unwrap();
        drop(connection);

        let snapshot = scan(home.path()).expect("OpenCode usage should be readable");
        let usage = snapshot.session_usage.expect("session usage should exist");
        assert_eq!(snapshot.provider, "opencode");
        assert_eq!(usage.input_tokens, 10);
        assert_eq!(usage.cost_usd, Some(0.25));
        assert_eq!(snapshot.observed_at, 1234);
    }
}
