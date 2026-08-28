use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::cmp::Reverse;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const COMMAND_CODE_API_URL: &str = "https://api.commandcode.ai";

const MAX_SESSION_FILES: usize = 384;
const MAX_TAIL_BYTES: u64 = 512 * 1024;
const MAX_PROVIDER_LIMIT_TAIL_BYTES: u64 = 8 * 1024 * 1024;
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
    pub session_usage: Option<AgentSessionUsage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_usage: Option<ProviderAccountUsage>,
    pub observed_at: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderAccountUsage {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub used_percent: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credits_remaining: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_count: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_usd: Option<f64>,
}

#[tauri::command]
pub async fn agent_usage_statuses(
    cwd: String,
    provider: Option<String>,
    native_session_id: Option<String>,
) -> Result<Vec<AgentUsageStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        scan_agent_usage(&cwd, provider.as_deref(), native_session_id.as_deref())
    })
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn provider_limit_statuses() -> Result<Vec<ProviderLimitStatus>, String> {
    let mut statuses = tauri::async_runtime::spawn_blocking(scan_provider_limit_statuses)
        .await
        .map_err(|error| error.to_string())??;
    if let Some(status) = fetch_command_code_usage().await {
        statuses.push(status);
    }
    Ok(statuses)
}

#[tauri::command]
pub async fn provider_limit_status(
    provider: String,
) -> Result<Option<ProviderLimitStatus>, String> {
    if provider == "cmd" {
        return Ok(fetch_command_code_usage().await);
    }
    tauri::async_runtime::spawn_blocking(move || {
        let home = dirs::home_dir()?;
        scan_local_provider_limit_status(&home, &provider)
    })
    .await
    .map_err(|error| error.to_string())
}

fn scan_agent_usage(
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
        let path = crate::modules::agent_chat::find_resumable_session_file(root, native_session_id)?;
        tail_lines(&path).into_iter().rev().find_map(|line| match provider {
            "codex" => parse_codex_status(&line),
            "claude" => parse_claude_status(&line),
            _ => None,
        })
    })
}

fn scan_provider_limit_statuses() -> Result<Vec<ProviderLimitStatus>, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };

    let statuses = ["codex", "claude", "opencode"]
        .into_iter()
        .filter_map(|provider| scan_local_provider_limit_status(&home, provider))
        .collect::<Vec<_>>();
    Ok(statuses)
}

fn scan_local_provider_limit_status(home: &Path, provider: &str) -> Option<ProviderLimitStatus> {
    match provider {
        "codex" => scan_codex_provider_usage(home),
        "claude" => scan_claude_provider_usage(home),
        "opencode" => scan_opencode_usage(home),
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

fn scan_opencode_usage(home: &Path) -> Option<ProviderLimitStatus> {
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

pub fn provider_limit_snapshot(
    status: AgentUsageStatus,
    observed_at: u64,
) -> Option<ProviderLimitStatus> {
    (!status.rate_limits.is_empty()).then_some(ProviderLimitStatus {
        provider: status.provider,
        rate_limits: status.rate_limits,
        session_usage: None,
        account_usage: None,
        observed_at,
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommandCodeAuth {
    api_key: String,
}

async fn fetch_command_code_usage() -> Option<ProviderLimitStatus> {
    let home = dirs::home_dir()?;
    let auth: CommandCodeAuth = serde_json::from_str(
        &fs::read_to_string(home.join(".commandcode").join("auth.json")).ok()?,
    )
    .ok()?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .ok()?;
    let whoami = command_code_get(&client, &auth.api_key, "/alpha/whoami", &[]).await?;
    let org_id = whoami.pointer("/org/id").and_then(Value::as_str);
    let org_query = org_id.map(|id| vec![("orgId", id)]).unwrap_or_default();
    let (credits, subscription) = futures_util::future::join(
        command_code_get(&client, &auth.api_key, "/alpha/billing/credits", &org_query),
        command_code_get(
            &client,
            &auth.api_key,
            "/alpha/billing/subscriptions",
            &org_query,
        ),
    )
    .await;
    let credits = credits?;
    let subscription = subscription?;
    let mut summary_query = org_query;
    if let Some(since) = subscription
        .pointer("/data/currentPeriodStart")
        .and_then(Value::as_str)
    {
        summary_query.push(("since", since));
    }
    let summary = command_code_get(
        &client,
        &auth.api_key,
        "/alpha/usage/summary",
        &summary_query,
    )
    .await?;

    command_code_usage_snapshot(&credits, &subscription, &summary, current_timestamp())
}

async fn command_code_get(
    client: &reqwest::Client,
    api_key: &str,
    endpoint: &str,
    query: &[(&str, &str)],
) -> Option<Value> {
    let bytes = client
        .get(format!("{COMMAND_CODE_API_URL}{endpoint}"))
        .bearer_auth(api_key)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .query(query)
        .send()
        .await
        .ok()?
        .error_for_status()
        .ok()?
        .bytes()
        .await
        .ok()?;
    serde_json::from_slice(&bytes).ok()
}

pub fn command_code_usage_snapshot(
    credits: &Value,
    subscription: &Value,
    summary: &Value,
    observed_at: u64,
) -> Option<ProviderLimitStatus> {
    let rate_limits = credits
        .get("windowLimits")
        .filter(|limits| {
            limits
                .get("limited")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .map(|limits| {
            [("fiveHour", "5-hour", 300), ("weekly", "Weekly", 10_080)]
                .into_iter()
                .filter_map(|(key, label, window_minutes)| {
                    command_code_rate_limit(limits.get(key)?, label, window_minutes)
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let plan_id = subscription.pointer("/data/planId").and_then(Value::as_str);
    let plan = plan_id.and_then(command_code_plan).map(str::to_string);
    let monthly_remaining = credits
        .pointer("/credits/monthlyCredits")
        .and_then(Value::as_f64)
        .unwrap_or_default()
        .max(0.0);
    let purchased_remaining = credits
        .pointer("/credits/purchasedCredits")
        .and_then(Value::as_f64)
        .unwrap_or_default()
        .max(0.0);
    let free_remaining = credits
        .pointer("/credits/freeCredits")
        .and_then(Value::as_f64)
        .unwrap_or_default()
        .max(0.0);
    let credits_remaining = monthly_remaining + purchased_remaining + free_remaining;
    let total_spent = summary
        .get("totalCost")
        .and_then(Value::as_f64)
        .unwrap_or_default()
        .max(0.0);
    let plan_total = plan_id.and_then(command_code_plan_credits);
    let total_pool = plan_total
        .map(|total| total.max(monthly_remaining) + purchased_remaining + free_remaining)
        .unwrap_or(total_spent + credits_remaining);
    let used_percent = (total_pool > 0.0).then(|| {
        ((total_pool - credits_remaining) / total_pool * 100.0)
            .clamp(0.0, 100.0)
            .round() as u8
    });
    let account_usage = ProviderAccountUsage {
        plan,
        used_percent,
        credits_remaining: (credits_remaining > 0.0 || total_spent > 0.0)
            .then_some(credits_remaining),
        request_count: summary.get("totalCount").and_then(Value::as_u64),
    };

    (!rate_limits.is_empty()
        || account_usage.plan.is_some()
        || account_usage.credits_remaining.is_some()
        || account_usage.request_count.is_some())
    .then_some(ProviderLimitStatus {
        provider: "cmd".to_string(),
        rate_limits,
        session_usage: None,
        account_usage: Some(account_usage),
        observed_at,
    })
}

fn command_code_rate_limit(
    value: &Value,
    label: &str,
    window_minutes: u32,
) -> Option<AgentRateLimit> {
    let used = value.get("used")?.as_f64()?;
    let cap = value.get("cap")?.as_f64()?;
    if cap <= 0.0 {
        return None;
    }
    let reset = value
        .get("resetAt")
        .and_then(Value::as_u64)
        .unwrap_or_default();
    Some(AgentRateLimit {
        label: label.to_string(),
        used_percent: (used / cap * 100.0).clamp(0.0, 100.0).round() as u8,
        window_minutes: Some(window_minutes),
        resets_at: (reset > 0).then_some(if reset > 100_000_000_000 {
            reset / 1000
        } else {
            reset
        }),
    })
}

fn command_code_plan(plan_id: &str) -> Option<&'static str> {
    match plan_id {
        id if id.starts_with("individual-goat") => Some("GOAT"),
        id if id.starts_with("individual-go") => Some("Go"),
        id if id.starts_with("individual-pro") => Some("Pro"),
        id if id.starts_with("individual-provider") => Some("Provider"),
        id if id.starts_with("individual-max") => Some("Max"),
        id if id.starts_with("individual-ultra") => Some("Ultra"),
        id if id.starts_with("teams-pro") => Some("Teams Pro"),
        _ => None,
    }
}

fn command_code_plan_credits(plan_id: &str) -> Option<f64> {
    match plan_id {
        id if id.starts_with("individual-goat") => Some(70.0),
        id if id.starts_with("individual-go") => Some(10.0),
        id if id.starts_with("individual-pro-v1") => Some(80.0),
        id if id.starts_with("individual-pro") => Some(30.0),
        id if id.starts_with("individual-provider") => Some(15.0),
        id if id.starts_with("individual-max") => Some(150.0),
        id if id.starts_with("individual-ultra") => Some(300.0),
        id if id.starts_with("teams-pro") => Some(40.0),
        _ => None,
    }
}

pub fn latest_provider_limit_snapshot(
    lines: &[String],
    observed_at: u64,
) -> Option<ProviderLimitStatus> {
    lines.iter().rev().find_map(|line| {
        parse_codex_status(line).and_then(|status| provider_limit_snapshot(status, observed_at))
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

fn parse_claude_session_usage(line: &str) -> Option<AgentSessionUsage> {
    let value: Value = serde_json::from_str(line).ok()?;
    let usage = value.pointer("/message/usage")?;
    Some(AgentSessionUsage {
        input_tokens: usage.get("input_tokens")?.as_u64()?,
        output_tokens: usage.get("output_tokens")?.as_u64()?,
        cache_read_tokens: usage
            .get("cache_read_input_tokens")
            .and_then(Value::as_u64)
            .unwrap_or_default(),
        cache_write_tokens: usage
            .get("cache_creation_input_tokens")
            .and_then(Value::as_u64)
            .unwrap_or_default(),
        cost_usd: None,
    })
}

fn parse_rate_limits(value: &Value) -> Vec<AgentRateLimit> {
    ["primary", "secondary"]
        .into_iter()
        .filter_map(|key| {
            let limit = value.get(key)?;
            let used_percent = limit.get("used_percent")?.as_f64()?.clamp(0.0, 100.0) as u8;
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

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn tail_lines(path: &Path) -> Vec<String> {
    tail_lines_with_limit(path, MAX_TAIL_BYTES)
}

fn tail_lines_with_limit(path: &Path, max_tail_bytes: u64) -> Vec<String> {
    let Ok(mut file) = File::open(path) else {
        return Vec::new();
    };
    let Ok(length) = file.metadata().map(|metadata| metadata.len()) else {
        return Vec::new();
    };
    let start = length.saturating_sub(max_tail_bytes);
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

#[cfg(test)]
pub(crate) fn provider_limit_tail_bytes() -> u64 {
    MAX_PROVIDER_LIMIT_TAIL_BYTES
}

#[cfg(test)]
pub(crate) fn terminal_usage_tail_bytes() -> u64 {
    MAX_TAIL_BYTES
}
