use super::{AgentUsageStatus, ProviderLimitStatus};
#[path = "agent_usage_scan/claude.rs"]
mod claude;
#[path = "agent_usage_scan/cmd.rs"]
mod cmd;
#[path = "agent_usage_scan/codex.rs"]
mod codex;
#[path = "agent_command_code_usage.rs"]
mod command_code;
#[path = "agent_command_code_projection.rs"]
mod command_code_projection;
#[path = "agent_usage_files.rs"]
mod files;
#[path = "agent_usage_scan/omp.rs"]
mod omp;
#[path = "agent_usage_opencode.rs"]
mod opencode_provider;
#[path = "agent_usage_scan/opencode.rs"]
mod opencode_scan;
#[path = "agent_usage_parsers.rs"]
mod parsers;
pub(crate) use command_code::fetch_command_code_usage;
pub use command_code_projection::command_code_usage_snapshot;
use files::{session_id_from_header, session_timestamp_ms_from_header};
pub use parsers::{
    context_remaining_percent, known_model_context_window, latest_provider_limit_snapshot,
    models_context_window, models_context_window_for_provider, parse_claude_status,
    parse_cmd_status, parse_codex_status, parse_omp_status, parse_opencode_message,
    provider_limit_snapshot,
};
use std::path::{Path, PathBuf};

const MAX_PROVIDER_LIMIT_TAIL_BYTES: u64 = 8 * 1024 * 1024;
const MAX_CODEX_SESSION_START_DRIFT_MS: u64 = 10 * 60 * 1_000;

pub(crate) fn scan_agent_usage(
    cwd: &str,
    provider: Option<&str>,
    native_session_id: Option<&str>,
    session_title_hint: Option<&str>,
    session_started_at_ms: Option<u64>,
) -> Result<Vec<AgentUsageStatus>, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };

    if let (Some(provider), Some(native_session_id)) = (provider, native_session_id) {
        return Ok(scan_exact_session_usage(&home, provider, native_session_id)
            .into_iter()
            .collect());
    }

    if let Some(provider) = provider {
        let status = match provider {
            "codex" => codex::scan(
                &home,
                cwd,
                session_started_at_ms,
                MAX_CODEX_SESSION_START_DRIFT_MS,
            ),
            "claude" => claude::scan(&home, cwd, session_started_at_ms),
            "omp" => omp::scan(&home, cwd, session_started_at_ms),
            "cmd" => cmd::scan(&home, cwd, session_started_at_ms),
            "opencode" => {
                opencode_scan::scan(&home, cwd, session_title_hint, session_started_at_ms)
            }
            _ => None,
        };
        return Ok(status.into_iter().collect());
    }

    let mut statuses = Vec::new();
    if let Some(status) = codex::scan(
        &home,
        cwd,
        session_started_at_ms,
        MAX_CODEX_SESSION_START_DRIFT_MS,
    ) {
        statuses.push(status);
    }
    if let Some(status) = claude::scan(&home, cwd, session_started_at_ms) {
        statuses.push(status);
    }
    if let Some(status) = omp::scan(&home, cwd, session_started_at_ms) {
        statuses.push(status);
    }
    if let Some(status) = cmd::scan(&home, cwd, session_started_at_ms) {
        statuses.push(status);
    }
    if let Some(status) = opencode_scan::scan(&home, cwd, session_title_hint, session_started_at_ms)
    {
        statuses.push(status);
    }
    Ok(statuses)
}

fn scan_exact_session_usage(
    home: &Path,
    provider: &str,
    native_session_id: &str,
) -> Option<AgentUsageStatus> {
    if native_session_id.is_empty()
        || native_session_id.len() > 100
        || !native_session_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return None;
    }
    match provider {
        "codex" => codex::scan_exact(home, native_session_id),
        "claude" => claude::scan_exact(home, native_session_id),
        "cmd" => cmd::scan_exact(home, native_session_id),
        "omp" => omp::scan_exact(home, native_session_id),
        "opencode" => opencode_scan::scan_exact(home, native_session_id),
        _ => None,
    }
}

pub(crate) fn scan_provider_limit_statuses() -> Result<Vec<ProviderLimitStatus>, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };

    let statuses = ["codex", "claude", "opencode"]
        .into_iter()
        .filter_map(|provider| scan_local_provider_limit_status(&home, provider))
        .collect::<Vec<_>>();
    Ok(statuses)
}

pub(crate) fn scan_local_provider_limit_status(
    home: &Path,
    provider: &str,
) -> Option<ProviderLimitStatus> {
    match provider {
        "codex" => codex::provider_usage(home, MAX_PROVIDER_LIMIT_TAIL_BYTES),
        "claude" => claude::provider_usage(home, MAX_PROVIDER_LIMIT_TAIL_BYTES),
        "opencode" => opencode_provider::scan(home),
        _ => None,
    }
}

pub(crate) fn claude_project_roots(home: &Path) -> [PathBuf; 2] {
    [
        home.join(".claude").join("projects"),
        home.join(".config").join("claude").join("projects"),
    ]
}

fn status_with_model_window(
    provider: &str,
    tokens: u64,
    model: &str,
    window: Option<u64>,
) -> AgentUsageStatus {
    // A local models cache is authoritative; otherwise fall back to the
    // well-known family table and mark the percentage estimated.
    let (window, estimated) = match window {
        Some(limit) => (Some(limit), false),
        None => match parsers::known_model_context_window(model) {
            Some(limit) => (Some(limit), true),
            None => (None, false),
        },
    };
    let _ = model;
    AgentUsageStatus {
        provider: provider.to_string(),
        native_session_id: None,
        context_window: window,
        context_tokens: Some(tokens),
        context_remaining_percent: window
            .map(|limit| parsers::context_remaining_percent(tokens, limit)),
        context_is_estimated: estimated,
        rate_limits: Vec::new(),
    }
}

fn with_session_id(mut status: AgentUsageStatus, path: &Path) -> AgentUsageStatus {
    status.native_session_id = session_id_from_header(path).or_else(|| {
        path.file_stem()
            .and_then(|name| name.to_str())
            .map(str::to_owned)
    });
    status
}

fn sort_session_files(mut files: Vec<PathBuf>, started_at_ms: Option<u64>) -> Vec<PathBuf> {
    if let Some(started_at_ms) = started_at_ms {
        files.sort_by_key(|path| {
            session_timestamp_ms_from_header(path)
                .map(|timestamp| timestamp.abs_diff(started_at_ms))
                .unwrap_or(u64::MAX)
        });
    }
    files
}

/// Session titles are matched with a parameterized exact comparison, so this
/// is only a shape guard: accept OpenCode's default "New session - <ISO>"
/// titles (and user titles in the same charset) and reject control bytes.
fn is_session_title_hint(hint: &str) -> bool {
    if hint.is_empty() || hint.len() > 80 {
        return false;
    }
    hint.bytes().all(|byte| {
        byte.is_ascii_alphanumeric() || matches!(byte, b' ' | b'-' | b':' | b'.' | b'/' | b'_')
    })
}
/// Looks up a model's context window in the shared models.dev cache paths.
/// When the provider is known, prefer its exact section before compatibility
/// fallbacks for qualified or bare model ids.
fn opencode_models_context_window(
    home: &Path,
    provider_id: Option<&str>,
    model_id: &str,
) -> Option<u64> {
    for relative_path in [
        ".cache/opencode/models.json",
        ".local/share/opencode/models.json",
    ] {
        let Ok(models_json) = std::fs::read_to_string(home.join(relative_path)) else {
            continue;
        };
        if let Some(provider_id) = provider_id {
            if let Some(window) =
                parsers::models_context_window_for_provider(&models_json, provider_id, model_id)
            {
                return Some(window);
            }
            if let Some(window) =
                parsers::models_context_window(&models_json, &format!("{provider_id}/{model_id}"))
            {
                return Some(window);
            }
        }
        if let Some(window) = parsers::models_context_window(&models_json, model_id) {
            return Some(window);
        }
    }
    None
}

#[cfg(test)]
pub(crate) fn provider_limit_tail_bytes() -> u64 {
    MAX_PROVIDER_LIMIT_TAIL_BYTES
}

#[cfg(test)]
pub(crate) fn terminal_usage_tail_bytes() -> u64 {
    files::terminal_usage_tail_bytes()
}

#[cfg(test)]
mod session_title_hint_tests {
    use super::is_session_title_hint;

    #[test]
    fn accepts_opencode_default_session_titles() {
        assert!(is_session_title_hint(
            "New session - 2026-09-03T11:35:14.641Z"
        ));
        assert!(is_session_title_hint("My debug session 2"));
    }

    #[test]
    fn rejects_empty_oversized_and_control_byte_hints() {
        assert!(!is_session_title_hint(""));
        assert!(!is_session_title_hint(&"x".repeat(81)));
        assert!(!is_session_title_hint("New session\nDROP TABLE session"));
        assert!(!is_session_title_hint("title with 'quotes'"));
        assert!(!is_session_title_hint("title; rm -rf ~"));
    }

    #[test]
    fn reads_opencode_model_limits_from_the_shared_data_cache_path() {
        let home = tempfile::tempdir().expect("temporary home should exist");
        let cache = home.path().join(".local/share/opencode");
        std::fs::create_dir_all(&cache).expect("OpenCode cache directory should exist");
        std::fs::write(
            cache.join("models.json"),
            r#"{"opencode":{"models":{"shared":{"limit":{"context":222222}}}}}"#,
        )
        .expect("OpenCode model cache should be writable in the test home");

        assert_eq!(
            super::opencode_models_context_window(home.path(), Some("opencode"), "shared"),
            Some(222222)
        );
    }
}

#[cfg(test)]
mod session_isolation_tests {
    use super::{
        cmd, codex, opencode_scan, scan_exact_session_usage, MAX_CODEX_SESSION_START_DRIFT_MS,
    };
    use rusqlite::Connection;
    use std::fs;

    fn command_code_transcript(id: &str, timestamp: &str, tokens: u64) -> String {
        format!(
            "{{\"type\":\"session\",\"version\":3,\"id\":\"{id}\",\"timestamp\":\"{timestamp}\",\"cwd\":\"/repo\"}}\n{{\"type\":\"message\",\"usage\":{{\"inputTokens\":{tokens},\"outputTokens\":0,\"cacheReadTokens\":0,\"cacheWriteTokens\":0}},\"model\":\"gpt-5\"}}\n"
        )
    }

    fn codex_transcript(id: &str, timestamp: &str, tokens: u64) -> String {
        let header = serde_json::json!({
            "type": "session_meta",
            "id": id,
            "timestamp": timestamp,
            "cwd": "/repo",
        });
        let token_count = serde_json::json!({
            "type": "event_msg",
            "payload": {
                "type": "token_count",
                "info": {
                    "model_context_window": 828400,
                    "last_token_usage": { "total_tokens": tokens },
                },
            },
        });
        format!("{}\n{}\n", header, token_count)
    }

    #[test]
    fn codex_scan_does_not_use_an_old_same_directory_session_for_a_new_pane() {
        let home = tempfile::tempdir().expect("temporary home should exist");
        let root = home.path().join(".codex/sessions/2026/09/05");
        fs::create_dir_all(&root).expect("session root should exist");
        fs::write(
            root.join("old.jsonl"),
            codex_transcript("old", "2026-09-05T00:00:00.000Z", 505_000),
        )
        .expect("old transcript should be writable");

        assert!(codex::scan(
            home.path(),
            "/repo",
            Some(1_788_570_000_000),
            MAX_CODEX_SESSION_START_DRIFT_MS,
        )
        .is_none());
    }

    #[test]
    fn codex_scan_accepts_a_session_created_near_the_new_pane() {
        let home = tempfile::tempdir().expect("temporary home should exist");
        let root = home.path().join(".codex/sessions/2026/09/05");
        fs::create_dir_all(&root).expect("session root should exist");
        fs::write(
            root.join("active.jsonl"),
            codex_transcript("active", "2026-09-05T00:05:00.000Z", 20),
        )
        .expect("active transcript should be writable");

        let status = codex::scan(
            home.path(),
            "/repo",
            Some(1_788_566_640_000),
            MAX_CODEX_SESSION_START_DRIFT_MS,
        )
        .expect("nearby Codex session should be found");

        assert_eq!(status.native_session_id.as_deref(), Some("active"));
        assert_eq!(status.context_tokens, Some(20));
    }

    #[test]
    fn command_code_scan_selects_the_session_nearest_to_the_pane_start() {
        let home = tempfile::tempdir().expect("temporary home should exist");
        let root = home.path().join(".commandcode/projects");
        fs::create_dir_all(&root).expect("session root should exist");
        fs::write(
            root.join("older.jsonl"),
            command_code_transcript("older", "2026-09-04T10:00:00.000Z", 10),
        )
        .expect("older transcript should be writable");
        fs::write(
            root.join("active.jsonl"),
            command_code_transcript("active", "2026-09-04T10:00:05.000Z", 20),
        )
        .expect("active transcript should be writable");

        let status = cmd::scan(home.path(), "/repo", Some(1_788_516_005_000))
            .expect("matching Command Code session should be found");

        assert_eq!(status.native_session_id.as_deref(), Some("active"));
        assert_eq!(status.context_tokens, Some(20));
    }

    #[test]
    fn command_code_exact_scan_does_not_fall_back_to_another_session() {
        let home = tempfile::tempdir().expect("temporary home should exist");
        let root = home.path().join(".commandcode/projects");
        fs::create_dir_all(&root).expect("session root should exist");
        fs::write(
            root.join("first.jsonl"),
            command_code_transcript("first", "2026-09-04T10:00:00.000Z", 10),
        )
        .expect("first transcript should be writable");
        fs::write(
            root.join("second.jsonl"),
            command_code_transcript("second", "2026-09-04T10:00:05.000Z", 20),
        )
        .expect("second transcript should be writable");

        let status = scan_exact_session_usage(home.path(), "cmd", "first")
            .expect("exact Command Code session should be found");

        assert_eq!(status.native_session_id.as_deref(), Some("first"));
        assert_eq!(status.context_tokens, Some(10));
    }

    #[test]
    fn opencode_scan_selects_the_session_nearest_to_the_pane_start() {
        let home = tempfile::tempdir().expect("temporary home should exist");
        let db_dir = home.path().join(".local/share/opencode");
        fs::create_dir_all(&db_dir).expect("OpenCode data directory should exist");
        let connection =
            Connection::open(db_dir.join("opencode.db")).expect("database should open");
        connection
            .execute_batch(
                "CREATE TABLE session (
                    id TEXT PRIMARY KEY,
                    directory TEXT NOT NULL,
                    title TEXT NOT NULL,
                    time_created INTEGER NOT NULL,
                    time_updated INTEGER NOT NULL
                );
                CREATE TABLE message (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    time_created INTEGER NOT NULL,
                    data TEXT NOT NULL
                );",
            )
            .expect("schema should be created");
        for (id, created_at, tokens) in [
            ("ses_old", 1_788_516_000_000u64, 10u64),
            ("ses_active", 1_788_516_005_000, 20),
        ] {
            connection
                .execute(
                    "INSERT INTO session (id, directory, title, time_created, time_updated) VALUES (?1, '/repo', ?1, ?2, ?2)",
                    rusqlite::params![id, created_at],
                )
                .expect("session should be inserted");
            let data = format!(
                "{{\"role\":\"assistant\",\"providerID\":\"test\",\"modelID\":\"gpt-5\",\"finish\":\"stop\",\"tokens\":{{\"input\":{tokens},\"cache\":{{\"read\":0}}}}}}"
            );
            connection
                .execute(
                    "INSERT INTO message (id, session_id, time_created, data) VALUES (?1, ?1, ?2, ?3)",
                    rusqlite::params![id, created_at, data],
                )
                .expect("message should be inserted");
        }
        drop(connection);

        let status = opencode_scan::scan(home.path(), "/repo", None, Some(1_788_516_005_000))
            .expect("matching OpenCode session should be found");

        assert_eq!(status.native_session_id.as_deref(), Some("ses_active"));
        assert_eq!(status.context_tokens, Some(20));
    }
}
