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
        native_session_id: None,
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
        native_session_id: None,
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

/// Session token usage plus the model it was recorded with.
/// omp writes `usage{input,output,cacheRead,cacheWrite,totalTokens}` per
/// session line together with the active `model` id.
pub fn parse_omp_status(line: &str) -> Option<(u64, String)> {
    let value: Value = serde_json::from_str(line).ok()?;
    let usage = value.get("usage")?;
    let summed = ["input", "output", "cacheRead", "cacheWrite"]
        .into_iter()
        .filter_map(|key| usage.get(key).and_then(Value::as_u64))
        .sum::<u64>();
    let total = usage
        .get("totalTokens")
        .and_then(Value::as_u64)
        .unwrap_or_default()
        .max(summed);
    let model = value.get("model").and_then(Value::as_str)?;
    if total == 0 || model.is_empty() {
        return None;
    }
    Some((total, model.to_string()))
}

/// Command Code writes top-level `usage{inputTokens,outputTokens,
/// cacheReadTokens,cacheWriteTokens}` and `model` per session line. The
/// active context is the prompt input plus cached prompt read; completion and
/// cache-write tokens do not occupy the active input window.
pub fn parse_cmd_status(line: &str) -> Option<(u64, String)> {
    let value: Value = serde_json::from_str(line).ok()?;
    if value.get("type").and_then(Value::as_str) == Some("session") {
        return None;
    }
    let usage = value.get("usage")?;
    let tokens = ["inputTokens", "cacheReadTokens"]
        .into_iter()
        .filter_map(|key| usage.get(key).and_then(Value::as_u64))
        .sum::<u64>();
    let model = value.get("model").and_then(Value::as_str)?;
    if tokens == 0 || model.is_empty() {
        return None;
    }
    Some((tokens, model.to_string()))
}

/// OpenCode assistant message payload:
/// `{role, providerID, modelID, finish?, tokens{input, cache{read}}}`.
/// Active context is the latest *completed* turn's `input + cache.read`:
/// the in-progress turn has no `finish` marker yet and must be skipped so
/// the badge agrees with opencode's own status line. The
/// `session.tokens_*` columns are cumulative across every turn and must
/// NOT be used (see docs/OPENCODE_CONTEXT_WINDOW.md).
pub fn parse_opencode_message(data: &str) -> Option<(u64, String, String)> {
    let value: Value = serde_json::from_str(data).ok()?;
    if value.get("role").and_then(Value::as_str) != Some("assistant") {
        return None;
    }
    if !matches!(value.get("finish"), Some(Value::String(_))) {
        return None;
    }
    let tokens = value.get("tokens")?;
    let active = tokens
        .get("input")
        .and_then(Value::as_u64)
        .unwrap_or_default()
        + tokens
            .get("cache")
            .and_then(|cache| cache.get("read"))
            .and_then(Value::as_u64)
            .unwrap_or_default();
    let provider = value.get("providerID").and_then(Value::as_str)?;
    let model = value.get("modelID").and_then(Value::as_str)?;
    if active == 0 || provider.is_empty() || model.is_empty() {
        return None;
    }
    Some((active, provider.to_string(), model.to_string()))
}

/// Finds a model's context window in a models.dev-style cache
/// (`~/.cache/opencode/models.json` or omp's `model_cache` rows):
/// `{provider: {models: {id: {limit: {context}}}}}` or `[{id, contextWindow}]`.
pub fn models_context_window(models_json: &str, model_id: &str) -> Option<u64> {
    let value: Value = serde_json::from_str(models_json).ok()?;
    if let Some(models) = value.as_array() {
        for model in models {
            if model.get("id").and_then(Value::as_str) == Some(model_id) {
                if let Some(window) = model.get("contextWindow").and_then(Value::as_u64) {
                    return Some(window);
                }
            }
        }
    }
    if let Some(providers) = value.as_object() {
        for provider in providers.values() {
            let models = provider.get("models")?;
            if let Some(window) = models
                .get(model_id)
                .and_then(|model| model.pointer("/limit/context"))
                .and_then(Value::as_u64)
            {
                return Some(window);
            }
        }
    }
    None
}

/// Finds a model's context window under its exact OpenCode provider section.
/// This avoids selecting a same-named model from another provider with a
/// different context limit.
pub fn models_context_window_for_provider(
    models_json: &str,
    provider_id: &str,
    model_id: &str,
) -> Option<u64> {
    let value: Value = serde_json::from_str(models_json).ok()?;
    value
        .get(provider_id)
        .and_then(|provider| provider.get("models"))
        .and_then(|models| models.get(model_id))
        .and_then(|model| model.pointer("/limit/context"))
        .and_then(Value::as_u64)
}

/// Well-known model context windows, used when neither the session file
/// nor a local models cache records the limit. Matched case-insensitively
/// by family substring; callers must mark results estimated. Deliberately
/// conservative: families with version-dependent windows (deepseek, qwen,
/// grok, llama) are omitted and resolve through the models cache instead.
pub fn known_model_context_window(model_id: &str) -> Option<u64> {
    let model = model_id.to_lowercase();
    // Order matters: check specific families before broader substrings.
    for (family, window) in [
        ("muse-spark", 1_048_576),
        ("claude", 200_000),
        ("gpt-4o", 128_000),
        ("gpt-4.1", 1_048_576),
        ("gpt-5", 400_000),
        ("gemini-2.", 1_048_576),
        ("gemini-1.5", 1_048_576),
        ("gemini-3", 1_048_576),
        ("gemini-flash", 1_048_576),
    ] {
        if model.contains(family) {
            return Some(window);
        }
    }
    None
}
