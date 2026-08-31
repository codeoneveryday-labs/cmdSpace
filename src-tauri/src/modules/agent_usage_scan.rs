use super::{AgentUsageStatus, ProviderLimitStatus};
#[path = "agent_command_code_usage.rs"]
mod command_code;
#[path = "agent_command_code_projection.rs"]
mod command_code_projection;
#[path = "agent_usage_files.rs"]
mod files;
#[path = "agent_usage_opencode.rs"]
mod opencode;
#[path = "agent_usage_parsers.rs"]
mod parsers;
pub(crate) use command_code::fetch_command_code_usage;
pub use command_code_projection::command_code_usage_snapshot;
use files::{
    codex_session_matches_cwd, escaped_claude_cwd, modified_at, newest_jsonl_files, tail_lines,
    tail_lines_with_limit,
};
pub use parsers::{
    context_remaining_percent, latest_provider_limit_snapshot, parse_claude_session_usage,
    parse_claude_status, parse_codex_status, provider_limit_snapshot,
};
use std::path::{Path, PathBuf};

const MAX_PROVIDER_LIMIT_TAIL_BYTES: u64 = 8 * 1024 * 1024;

pub(crate) fn scan_agent_usage(
    cwd: &str,
    provider: Option<&str>,
    native_session_id: Option<&str>,
) -> Result<Vec<AgentUsageStatus>, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };

    if let (Some(provider), Some(native_session_id)) = (provider, native_session_id) {
        return Ok(scan_exact_session_usage(&home, provider, native_session_id)
            .into_iter()
            .collect());
    }

    let mut statuses = Vec::new();
    if let Some(status) = scan_codex(&home, cwd) {
        statuses.push(status);
    }
    if let Some(status) = scan_claude(&home, cwd) {
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
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return None;
    }
    let roots: Vec<PathBuf> = match provider {
        "codex" => vec![home.join(".codex").join("sessions")],
        "claude" => claude_project_roots(home).into(),
        _ => return None,
    };
    roots.iter().find_map(|root| {
        let path =
            crate::modules::agent_chat::find_resumable_session_file(root, native_session_id)?;
        tail_lines(&path)
            .into_iter()
            .rev()
            .find_map(|line| match provider {
                "codex" => parse_codex_status(&line),
                "claude" => parse_claude_status(&line),
                _ => None,
            })
    })
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
        "codex" => scan_codex_provider_usage(home),
        "claude" => scan_claude_provider_usage(home),
        "opencode" => opencode::scan(home),
        _ => None,
    }
}

fn scan_codex_provider_usage(home: &Path) -> Option<ProviderLimitStatus> {
    let sessions_root = home.join(".codex").join("sessions");
    for file in newest_jsonl_files(&sessions_root, 4) {
        let observed_at = modified_at(&file);
        if let Some(snapshot) = latest_provider_limit_snapshot(
            &tail_lines_with_limit(&file, MAX_PROVIDER_LIMIT_TAIL_BYTES),
            observed_at,
        ) {
            return Some(snapshot);
        }
    }
    None
}

fn scan_claude_provider_usage(home: &Path) -> Option<ProviderLimitStatus> {
    claude_project_roots(home).into_iter().find_map(|root| {
        newest_jsonl_files(&root, 2).into_iter().find_map(|file| {
            let observed_at = modified_at(&file);
            tail_lines_with_limit(&file, MAX_PROVIDER_LIMIT_TAIL_BYTES)
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

pub(crate) fn claude_project_roots(home: &Path) -> [PathBuf; 2] {
    [
        home.join(".claude").join("projects"),
        home.join(".config").join("claude").join("projects"),
    ]
}

fn scan_codex(home: &Path, cwd: &str) -> Option<AgentUsageStatus> {
    let sessions_root = home.join(".codex").join("sessions");
    let files = newest_jsonl_files(&sessions_root, 4);

    for file in files {
        if !codex_session_matches_cwd(&file, cwd) {
            continue;
        }
        if let Some(status) = tail_lines(&file)
            .into_iter()
            .rev()
            .find_map(|line| parse_codex_status(&line))
        {
            return Some(status);
        }
    }
    None
}

fn scan_claude(home: &Path, cwd: &str) -> Option<AgentUsageStatus> {
    let project_name = escaped_claude_cwd(cwd);
    let roots = claude_project_roots(home).map(|root| root.join(&project_name));

    for root in roots {
        for file in newest_jsonl_files(&root, 1) {
            if let Some(status) = tail_lines(&file)
                .into_iter()
                .rev()
                .find_map(|line| parse_claude_status(&line))
            {
                return Some(status);
            }
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
