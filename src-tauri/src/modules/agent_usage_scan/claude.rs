use std::path::Path;

use super::super::{AgentUsageStatus, ProviderLimitStatus};
use super::files::{
    escaped_claude_cwd, modified_at, newest_jsonl_files, tail_lines, tail_lines_with_limit,
};
use super::parsers::{parse_claude_session_usage, parse_claude_status};
use super::{claude_project_roots, sort_session_files, with_session_id};

pub(super) fn scan(
    home: &Path,
    cwd: &str,
    session_started_at_ms: Option<u64>,
) -> Option<AgentUsageStatus> {
    let project_name = escaped_claude_cwd(cwd);
    let roots = claude_project_roots(home).map(|root| root.join(&project_name));

    for root in roots {
        for file in sort_session_files(newest_jsonl_files(&root, 1), session_started_at_ms) {
            if let Some(status) = tail_lines(&file)
                .into_iter()
                .rev()
                .find_map(|line| parse_claude_status(&line))
            {
                return Some(with_session_id(status, &file));
            }
        }
    }
    None
}

pub(super) fn scan_exact(home: &Path, native_session_id: &str) -> Option<AgentUsageStatus> {
    let roots = claude_project_roots(home);
    roots.iter().find_map(|root| {
        let path =
            crate::modules::agent_chat::find_resumable_session_file(root, native_session_id)?;
        tail_lines(&path)
            .into_iter()
            .rev()
            .find_map(|line| parse_claude_status(&line))
            .map(|mut status| {
                status.native_session_id = Some(native_session_id.to_string());
                status
            })
    })
}

pub(super) fn provider_usage(home: &Path, max_tail_bytes: u64) -> Option<ProviderLimitStatus> {
    claude_project_roots(home).into_iter().find_map(|root| {
        newest_jsonl_files(&root, 2).into_iter().find_map(|file| {
            let observed_at = modified_at(&file);
            tail_lines_with_limit(&file, max_tail_bytes)
                .iter()
                .rev()
                .find_map(|line| parse_claude_session_usage(line))
                .map(|session_usage| ProviderLimitStatus {
                    provider: "claude".to_string(),
                    rate_limits: Vec::new(),
                    session_usage: Some(session_usage),
                    account_usage: None,
                    observed_at,
                })
        })
    })
}
