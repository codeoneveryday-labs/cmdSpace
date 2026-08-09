use super::agent_usage::{context_remaining_percent, parse_codex_status, provider_limit_snapshot};

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
