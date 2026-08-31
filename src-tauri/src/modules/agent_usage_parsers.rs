use serde_json::Value;

use super::super::{AgentRateLimit, AgentSessionUsage, AgentUsageStatus, ProviderLimitStatus};

const CLAUDE_CONTEXT_WINDOW_ESTIMATE: u64 = 200_000;

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

pub fn latest_provider_limit_snapshot(
    lines: &[String],
    observed_at: u64,
) -> Option<ProviderLimitStatus> {
    lines.iter().rev().find_map(|line| {
        parse_codex_status(line).and_then(|status| provider_limit_snapshot(status, observed_at))
    })
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

pub fn parse_claude_status(line: &str) -> Option<AgentUsageStatus> {
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

pub fn parse_claude_session_usage(line: &str) -> Option<AgentSessionUsage> {
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
