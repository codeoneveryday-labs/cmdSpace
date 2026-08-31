use serde_json::Value;

use super::super::{AgentRateLimit, ProviderAccountUsage, ProviderLimitStatus};

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

#[cfg(test)]
mod tests {
    use super::command_code_usage_snapshot;

    #[test]
    fn returns_no_snapshot_when_command_code_reports_no_usage() {
        assert!(command_code_usage_snapshot(
            &serde_json::json!({}),
            &serde_json::json!({}),
            &serde_json::json!({}),
            1,
        )
        .is_none());
    }
}
