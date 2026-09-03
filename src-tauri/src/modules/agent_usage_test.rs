use super::agent_usage::{
    claude_project_roots, command_code_usage_snapshot, context_remaining_percent,
    known_model_context_window, models_context_window, parse_cmd_status, parse_codex_status,
    parse_omp_status, parse_opencode_message, provider_limit_snapshot, AgentSessionUsage,
    ProviderAccountUsage,
};
use std::path::Path;

#[test]
fn codex_status_uses_the_last_turn_and_preserves_the_rate_limit_window() {
    let line = r#"{"type":"event_msg","payload":{"type":"token_count","info":{"model_context_window":200000,"last_token_usage":{"total_tokens":180000}},"rate_limits":{"primary":{"used_percent":42,"window_minutes":300,"resets_at":1750000000}}}}"#;

    let status = parse_codex_status(line).expect("codex token count should parse");

    assert_eq!(status.context_window, Some(200_000));
    assert_eq!(status.context_tokens, Some(180_000));
    assert_eq!(status.context_remaining_percent, Some(10));
    assert_eq!(status.rate_limits.len(), 1);
    assert_eq!(status.rate_limits[0].used_percent, 42);
    assert_eq!(status.rate_limits[0].window_minutes, Some(300));
}

#[test]
fn codex_status_accepts_usage_percent_reported_as_a_decimal() {
    let line = r#"{"type":"event_msg","payload":{"type":"token_count","info":{"model_context_window":200000,"last_token_usage":{"total_tokens":180000}},"rate_limits":{"primary":{"used_percent":87.0,"window_minutes":10080,"resets_at":1786865612}}}}"#;

    let status = parse_codex_status(line).expect("codex token count should parse");

    assert_eq!(status.rate_limits.len(), 1);
    assert_eq!(status.rate_limits[0].used_percent, 87);
}

#[test]
fn context_remaining_percent_clamps_usage_that_exceeds_the_window() {
    assert_eq!(context_remaining_percent(250_000, 200_000), 0);
    assert_eq!(context_remaining_percent(0, 200_000), 100);
}

#[test]
fn provider_limit_snapshot_excludes_context_usage_and_requires_reported_limits() {
    let line = r#"{"type":"event_msg","payload":{"type":"token_count","info":{"model_context_window":200000,"last_token_usage":{"total_tokens":180000}},"rate_limits":{"primary":{"used_percent":42,"window_minutes":300,"resets_at":1750000000}}}}"#;
    let status = parse_codex_status(line).expect("codex token count should parse");

    let snapshot = provider_limit_snapshot(status, 1_750_000_001)
        .expect("reported limits should produce a provider snapshot");

    assert_eq!(snapshot.provider, "codex");
    assert_eq!(snapshot.observed_at, 1_750_000_001);
    assert_eq!(snapshot.rate_limits.len(), 1);
    assert_eq!(snapshot.rate_limits[0].label, "Primary");
}

#[test]
fn provider_limit_scan_skips_newer_events_that_do_not_report_a_quota() {
    let reported = r#"{"type":"event_msg","payload":{"type":"token_count","info":{"model_context_window":200000,"last_token_usage":{"total_tokens":180000}},"rate_limits":{"primary":{"used_percent":42,"window_minutes":300,"resets_at":1750000000}}}}"#;
    let newer_without_quota = r#"{"type":"event_msg","payload":{"type":"token_count","info":{"model_context_window":200000,"last_token_usage":{"total_tokens":181000}}}}"#;
    let lines = vec![reported.to_string(), newer_without_quota.to_string()];

    let snapshot = super::agent_usage::latest_provider_limit_snapshot(&lines, 1_750_000_001)
        .expect("the latest event that reports a quota should be used");

    assert_eq!(snapshot.rate_limits[0].used_percent, 42);
}

#[test]
fn provider_limit_dashboard_scans_a_deeper_transcript_tail_than_terminal_usage() {
    assert!(
        super::agent_usage::provider_limit_tail_bytes()
            > super::agent_usage::terminal_usage_tail_bytes()
    );
}

#[test]
fn claude_provider_limits_scan_every_supported_project_root() {
    let roots = claude_project_roots(Path::new("/tmp/cmdspace-home"));

    assert_eq!(roots[0], Path::new("/tmp/cmdspace-home/.claude/projects"));
    assert_eq!(
        roots[1],
        Path::new("/tmp/cmdspace-home/.config/claude/projects")
    );
}

#[test]
fn command_code_usage_matches_the_account_metrics_reported_by_slash_usage() {
    let credits = serde_json::json!({
        "credits": {
            "monthlyCredits": 8.45,
            "purchasedCredits": 0.0,
            "freeCredits": 0.0
        },
        "windowLimits": {
            "limited": true,
            "fiveHour": { "used": 1.5, "cap": 3.0, "resetAt": 0 },
            "weekly": { "used": 1.55, "cap": 6.0, "resetAt": 1_786_600_692_814_u64 }
        }
    });
    let subscription = serde_json::json!({
        "data": { "planId": "individual-go", "status": "active" }
    });
    let summary = serde_json::json!({ "totalCount": 1_522, "totalCost": 1.56 });

    let status = command_code_usage_snapshot(&credits, &subscription, &summary, 1_786_000_000)
        .expect("Command Code /usage response should produce a snapshot");

    assert_eq!(status.provider, "cmd");
    assert!(status.session_usage.is_none());
    assert_eq!(status.rate_limits[0].label, "5-hour");
    assert_eq!(status.rate_limits[0].used_percent, 50);
    assert_eq!(status.rate_limits[1].label, "Weekly");
    assert_eq!(status.rate_limits[1].used_percent, 26);
    assert_eq!(status.rate_limits[1].resets_at, Some(1_786_600_692));

    let account = status
        .account_usage
        .expect("account usage should be present");
    assert_eq!(account.plan, Some("Go".to_string()));
    assert_eq!(account.used_percent, Some(16));
    assert_eq!(account.credits_remaining, Some(8.45));
    assert_eq!(account.request_count, Some(1_522));
}

#[test]
fn provider_usage_payload_omits_an_unavailable_session_cost() {
    let usage = AgentSessionUsage {
        input_tokens: 12,
        output_tokens: 3,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        cost_usd: None,
    };

    let payload = serde_json::to_value(usage).expect("session usage should serialize");

    assert_eq!(payload.get("costUsd"), None);
}

#[test]
fn provider_usage_payload_omits_unavailable_account_metrics() {
    let usage = ProviderAccountUsage {
        plan: None,
        used_percent: None,
        credits_remaining: None,
        request_count: None,
    };

    let payload = serde_json::to_value(usage).expect("account usage should serialize");

    assert_eq!(payload.get("plan"), None);
    assert_eq!(payload.get("usedPercent"), None);
    assert_eq!(payload.get("creditsRemaining"), None);
    assert_eq!(payload.get("requestCount"), None);
}

#[test]
fn omp_status_reads_total_tokens_and_model() {
    let line = r#"{"cwd":"/repo","model":"gpt-5.6-sol","usage":{"input":100,"output":50,"cacheRead":10,"cacheWrite":5,"totalTokens":165,"cost":{"total":0}}}"#;

    let (tokens, model) = parse_omp_status(line).expect("omp usage should parse");

    assert_eq!(tokens, 165);
    assert_eq!(model, "gpt-5.6-sol");
}

#[test]
fn omp_status_ignores_zero_token_lines() {
    let line = r#"{"cwd":"/repo","model":"gpt-5.6-sol","usage":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"totalTokens":0}}"#;

    assert!(parse_omp_status(line).is_none());
}

#[test]
fn cmd_status_sums_token_fields_with_model() {
    let line = r#"{"type":"message","id":"a1","message":{"role":"assistant"},"usage":{"inputTokens":30021,"outputTokens":543,"cacheReadTokens":10368,"cacheWriteTokens":0},"model":"deepseek/deepseek-v4-flash"}"#;

    let (tokens, model) = parse_cmd_status(line).expect("cmd usage should parse");

    assert_eq!(tokens, 30021 + 543 + 10368);
    assert_eq!(model, "deepseek/deepseek-v4-flash");
}

#[test]
fn cmd_status_skips_session_headers() {
    let line = r#"{"type":"session","id":"abc","cwd":"/repo"}"#;

    assert!(parse_cmd_status(line).is_none());
}

#[test]
fn models_context_window_resolves_models_dev_cache_shape() {
    let cache = r#"{"hpc-ai":{"models":{"deepseek/deepseek-v4-flash":{"limit":{"context":1048576}}}}}"#;

    assert_eq!(
        models_context_window(cache, "deepseek/deepseek-v4-flash"),
        Some(1_048_576)
    );
    assert_eq!(models_context_window(cache, "unknown/model"), None);
}

#[test]
fn models_context_window_resolves_omp_model_cache_shape() {
    let cache = r#"[{"id":"gpt-5.6-sol","contextWindow":200000}]"#;

    assert_eq!(models_context_window(cache, "gpt-5.6-sol"), Some(200_000));
    assert_eq!(models_context_window(cache, "other/model"), None);
}

#[test]
fn known_model_context_window_matches_families_case_insensitively() {
    assert_eq!(known_model_context_window("claude-sonnet-4-5"), Some(200_000));
    assert_eq!(
        known_model_context_window("Claude-Opus-4-1"),
        Some(200_000)
    );
    assert_eq!(known_model_context_window("gpt-4o"), Some(128_000));
    assert_eq!(known_model_context_window("gpt-4.1-mini"), Some(1_048_576));
    assert_eq!(known_model_context_window("gpt-5-mini"), Some(400_000));
    assert_eq!(
        known_model_context_window("gemini-2.5-pro"),
        Some(1_048_576)
    );
    assert_eq!(
        known_model_context_window("gemini-3.1-pro-preview"),
        Some(1_048_576)
    );
    assert_eq!(
        known_model_context_window("meta/muse-spark-1.3-contributor-free"),
        Some(1_048_576)
    );
}

#[test]
fn known_model_context_window_omits_version_dependent_families() {
    assert_eq!(known_model_context_window("deepseek-v4-flash"), None);
    assert_eq!(known_model_context_window("qwen3-max"), None);
    assert_eq!(known_model_context_window("grok-4"), None);
    assert_eq!(known_model_context_window("llama-3.3-70b"), None);
    assert_eq!(known_model_context_window(""), None);
}

#[test]
fn opencode_message_uses_latest_turn_input_plus_cache_read() {
    // Mirrors docs/OPENCODE_CONTEXT_WINDOW.md: session.tokens_* columns are
    // cumulative and must not be used.
    let data = r#"{"role":"assistant","providerID":"opencode","modelID":"muse-spark-1.3-contributor-free","finish":"stop","tokens":{"input":529,"output":110,"reasoning":0,"cache":{"read":477937,"write":0}}}"#;

    let (tokens, model) =
        parse_opencode_message(data).expect("opencode message should parse");

    assert_eq!(tokens, 529 + 477937);
    assert_eq!(model, "muse-spark-1.3-contributor-free");
}

#[test]
fn opencode_message_skips_in_progress_turns_without_finish() {
    // Matches opencode's own status line, which only counts completed turns.
    let running = r#"{"role":"assistant","providerID":"opencode","modelID":"m","finish":null,"tokens":{"input":1204,"cache":{"read":491121}}}"#;
    assert!(parse_opencode_message(running).is_none());

    let placeholder = r#"{"role":"assistant","providerID":"opencode","modelID":"m","tokens":{"input":0,"cache":{"read":0}}}"#;
    assert!(parse_opencode_message(placeholder).is_none());
}

#[test]
fn opencode_message_skips_user_messages_and_empty_turns() {
    let user = r#"{"role":"user","providerID":"opencode","modelID":"m","tokens":{"input":10,"cache":{"read":0}}}"#;
    assert!(parse_opencode_message(user).is_none());

    let empty = r#"{"role":"assistant","providerID":"opencode","modelID":"m","tokens":{"input":0,"cache":{"read":0}}}"#;
    assert!(parse_opencode_message(empty).is_none());
}
