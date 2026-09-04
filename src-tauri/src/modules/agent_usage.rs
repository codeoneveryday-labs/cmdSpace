use serde::Serialize;

#[path = "agent_usage_scan.rs"]
mod scan;

#[allow(unused_imports)]
pub(crate) use scan::claude_project_roots;
#[allow(unused_imports)]
pub use scan::{
    command_code_usage_snapshot, context_remaining_percent, known_model_context_window,
    latest_provider_limit_snapshot, models_context_window, models_context_window_for_provider,
    parse_claude_status, parse_cmd_status, parse_codex_status, parse_omp_status,
    parse_opencode_message, provider_limit_snapshot,
};
use scan::{
    fetch_command_code_usage, scan_agent_usage, scan_local_provider_limit_status,
    scan_provider_limit_statuses,
};
#[cfg(test)]
pub(crate) use scan::{provider_limit_tail_bytes, terminal_usage_tail_bytes};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentUsageStatus {
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_session_id: Option<String>,
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
    session_title_hint: Option<String>,
    session_started_at_ms: Option<u64>,
) -> Result<Vec<AgentUsageStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        scan_agent_usage(
            &cwd,
            provider.as_deref(),
            native_session_id.as_deref(),
            session_title_hint.as_deref(),
            session_started_at_ms,
        )
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
