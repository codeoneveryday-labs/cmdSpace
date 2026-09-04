use std::path::Path;

use super::super::{AgentUsageStatus, ProviderLimitStatus};
use super::files::{
    codex_session_matches_cwd, modified_at, newest_jsonl_files, tail_lines, tail_lines_with_limit,
};
use super::parsers::{latest_provider_limit_snapshot, parse_codex_status};
use super::{session_timestamp_ms_from_header, sort_session_files, with_session_id};

pub(super) fn scan(
    home: &Path,
    cwd: &str,
    session_started_at_ms: Option<u64>,
    max_session_start_drift_ms: u64,
) -> Option<AgentUsageStatus> {
    let sessions_root = home.join(".codex").join("sessions");
    let files = newest_jsonl_files(&sessions_root, 4);

    for file in sort_session_files(files, session_started_at_ms) {
        if let Some(started_at_ms) = session_started_at_ms {
            let Some(session_timestamp_ms) = session_timestamp_ms_from_header(&file) else {
                continue;
            };
            if session_timestamp_ms.abs_diff(started_at_ms) > max_session_start_drift_ms {
                continue;
            }
        }
        if !codex_session_matches_cwd(&file, cwd) {
            continue;
        }
        if let Some(status) = tail_lines(&file)
            .into_iter()
            .rev()
            .find_map(|line| parse_codex_status(&line))
        {
            return Some(with_session_id(status, &file));
        }
    }
    None
}

pub(super) fn scan_exact(home: &Path, native_session_id: &str) -> Option<AgentUsageStatus> {
    let path = crate::modules::agent_chat::find_resumable_session_file(
        &home.join(".codex").join("sessions"),
        native_session_id,
    )?;
    tail_lines(&path)
        .into_iter()
        .rev()
        .find_map(|line| parse_codex_status(&line))
        .map(|mut status| {
            status.native_session_id = Some(native_session_id.to_string());
            status
        })
}

pub(super) fn provider_usage(home: &Path, max_tail_bytes: u64) -> Option<ProviderLimitStatus> {
    let sessions_root = home.join(".codex").join("sessions");
    for file in newest_jsonl_files(&sessions_root, 4) {
        let observed_at = modified_at(&file);
        if let Some(snapshot) = latest_provider_limit_snapshot(
            &tail_lines_with_limit(&file, max_tail_bytes),
            observed_at,
        ) {
            return Some(snapshot);
        }
    }
    None
}
