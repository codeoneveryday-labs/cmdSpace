use serde::Serialize;
use serde_json::Value;
use std::cmp::Reverse;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const MAX_SESSION_FILES: usize = 384;
const MAX_TAIL_BYTES: u64 = 512 * 1024;
const CLAUDE_CONTEXT_WINDOW_ESTIMATE: u64 = 200_000;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentUsageStatus {
    pub provider: String,
    pub context_window: Option<u64>,
    pub context_tokens: Option<u64>,
    pub context_remaining_percent: Option<u8>,
    pub context_is_estimated: bool,
    pub rate_limits: Vec<AgentRateLimit>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRateLimit {
    pub label: String,
    pub used_percent: u8,
    pub window_minutes: Option<u32>,
    pub resets_at: Option<u64>,
}

/// A provider-wide quota snapshot. It intentionally excludes the per-session
/// context counters shown in terminal chrome.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderLimitStatus {
    pub provider: String,
    pub rate_limits: Vec<AgentRateLimit>,
    pub observed_at: u64,
}

#[tauri::command]
pub async fn agent_usage_statuses(cwd: String) -> Result<Vec<AgentUsageStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || scan_agent_usage(&cwd))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn provider_limit_statuses() -> Result<Vec<ProviderLimitStatus>, String> {
    tauri::async_runtime::spawn_blocking(scan_provider_limit_statuses)
        .await
        .map_err(|error| error.to_string())?
}

fn scan_agent_usage(cwd: &str) -> Result<Vec<AgentUsageStatus>, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };

    let mut statuses = Vec::new();
    if let Some(status) = scan_codex(&home, cwd) {
        statuses.push(status);
    }
    if let Some(status) = scan_claude(&home, cwd) {
        statuses.push(status);
    }
    Ok(statuses)
}

fn scan_provider_limit_statuses() -> Result<Vec<ProviderLimitStatus>, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };

    let sessions_root = home.join(".codex").join("sessions");
    for file in newest_jsonl_files(&sessions_root, 4) {
        let observed_at = modified_at(&file);
        if let Some(snapshot) = tail_lines(&file)
            .into_iter()
            .rev()
            .find_map(|line| parse_codex_status(&line))
            .and_then(|status| provider_limit_snapshot(status, observed_at))
        {
            return Ok(vec![snapshot]);
        }
    }

    Ok(Vec::new())
}

pub fn provider_limit_snapshot(
    status: AgentUsageStatus,
    observed_at: u64,
) -> Option<ProviderLimitStatus> {
    (!status.rate_limits.is_empty()).then_some(ProviderLimitStatus {
        provider: status.provider,
        rate_limits: status.rate_limits,
        observed_at,
    })
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
    let roots = [
        home.join(".claude").join("projects").join(&project_name),
        home.join(".config")
            .join("claude")
            .join("projects")
            .join(&project_name),
    ];

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

pub fn context_remaining_percent(tokens: u64, context_window: u64) -> u8 {
    if context_window == 0 {
        return 0;
    }
    let used_percent = tokens.saturating_mul(100) / context_window;
    100u64.saturating_sub(used_percent.min(100)) as u8
}

pub fn parse_codex_status(line: &str) -> Option<AgentUsageStatus> {
    let value: Value = serde_json::from_str(line).ok()?;
    let info = value.pointer("/payload/info")?;
    let context_window = info
        .get("model_context_window")
        .or_else(|| value.pointer("/payload/model_context_window"))
        .and_then(Value::as_u64)?;
    let context_tokens = info
        .pointer("/last_token_usage/total_tokens")
        .and_then(Value::as_u64)?;

    let rate_limits = value
        .pointer("/payload/rate_limits")
        .map(parse_rate_limits)
        .unwrap_or_default();

    Some(AgentUsageStatus {
        provider: "codex".to_string(),
        context_window: Some(context_window),
        context_tokens: Some(context_tokens),
        context_remaining_percent: Some(context_remaining_percent(context_tokens, context_window)),
        context_is_estimated: false,
        rate_limits,
    })
}

fn parse_claude_status(line: &str) -> Option<AgentUsageStatus> {
    let value: Value = serde_json::from_str(line).ok()?;
    let usage = value.pointer("/message/usage")?;
    let context_tokens = [
        "input_tokens",
        "output_tokens",
        "cache_creation_input_tokens",
        "cache_read_input_tokens",
    ]
    .into_iter()
    .filter_map(|key| usage.get(key).and_then(Value::as_u64))
    .sum::<u64>();
    if context_tokens == 0 {
        return None;
    }

    Some(AgentUsageStatus {
        provider: "claude".to_string(),
        context_window: Some(CLAUDE_CONTEXT_WINDOW_ESTIMATE),
        context_tokens: Some(context_tokens),
        context_remaining_percent: Some(context_remaining_percent(
            context_tokens,
            CLAUDE_CONTEXT_WINDOW_ESTIMATE,
        )),
        context_is_estimated: true,
        rate_limits: Vec::new(),
    })
}

fn parse_rate_limits(value: &Value) -> Vec<AgentRateLimit> {
    ["primary", "secondary"]
        .into_iter()
        .filter_map(|key| {
            let limit = value.get(key)?;
            let used_percent = limit.get("used_percent")?.as_u64()?.min(100) as u8;
            Some(AgentRateLimit {
                label: if key == "primary" {
                    "Primary".to_string()
                } else {
                    "Secondary".to_string()
                },
                used_percent,
                window_minutes: limit
                    .get("window_minutes")
                    .and_then(Value::as_u64)
                    .and_then(|minutes| u32::try_from(minutes).ok()),
                resets_at: limit.get("resets_at").and_then(Value::as_u64),
            })
        })
        .collect()
}

fn codex_session_matches_cwd(path: &Path, cwd: &str) -> bool {
    let Ok(file) = File::open(path) else {
        return false;
    };
    let mut first_line = String::new();
    let mut reader = std::io::BufReader::new(file);
    if std::io::BufRead::read_line(&mut reader, &mut first_line).is_err() {
        return false;
    }
    let Ok(value) = serde_json::from_str::<Value>(&first_line) else {
        return false;
    };
    find_cwd(&value).is_some_and(|candidate| same_path(candidate, cwd))
}

fn find_cwd(value: &Value) -> Option<&str> {
    match value {
        Value::Object(values) => values
            .get("cwd")
            .and_then(Value::as_str)
            .or_else(|| values.values().find_map(find_cwd)),
        Value::Array(values) => values.iter().find_map(find_cwd),
        _ => None,
    }
}

fn same_path(left: &str, right: &str) -> bool {
    left.trim_end_matches('/') == right.trim_end_matches('/')
}

fn escaped_claude_cwd(cwd: &str) -> String {
    cwd.chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect()
}

fn newest_jsonl_files(root: &Path, max_depth: u8) -> Vec<PathBuf> {
    let mut files = Vec::new();
    collect_jsonl_files(root, max_depth, &mut files);
    files.sort_by_key(|path| Reverse(modified_at(path)));
    files.truncate(MAX_SESSION_FILES);
    files
}

fn collect_jsonl_files(root: &Path, depth: u8, files: &mut Vec<PathBuf>) {
    if depth == 0 || files.len() >= MAX_SESSION_FILES {
        return;
    }
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    let mut entries: Vec<_> = entries.flatten().collect();
    // Session folders are date-named. Descending traversal makes the cap
    // deterministic and strongly favors the active/recent session.
    entries.sort_by_key(|entry| Reverse(entry.file_name()));
    for entry in entries {
        if files.len() >= MAX_SESSION_FILES {
            break;
        }
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl_files(&path, depth - 1, files);
        } else if path
            .extension()
            .is_some_and(|extension| extension == "jsonl")
        {
            files.push(path);
        }
    }
}

fn modified_at(path: &Path) -> u64 {
    path.metadata()
        .and_then(|metadata| metadata.modified())
        .and_then(|time| {
            time.duration_since(UNIX_EPOCH)
                .map_err(std::io::Error::other)
        })
        .unwrap_or_default()
        .as_secs()
}

fn tail_lines(path: &Path) -> Vec<String> {
    let Ok(mut file) = File::open(path) else {
        return Vec::new();
    };
    let Ok(length) = file.metadata().map(|metadata| metadata.len()) else {
        return Vec::new();
    };
    let start = length.saturating_sub(MAX_TAIL_BYTES);
    if file.seek(SeekFrom::Start(start)).is_err() {
        return Vec::new();
    }
    let mut content = String::new();
    if file.read_to_string(&mut content).is_err() {
        return Vec::new();
    }
    let mut lines: Vec<String> = content.lines().map(str::to_owned).collect();
    if start > 0 && !lines.is_empty() {
        lines.remove(0);
    }
    lines
}
