use super::super::ProviderLimitStatus;
use serde::Deserialize;
use serde_json::Value;
use std::fs;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const COMMAND_CODE_API_URL: &str = "https://api.commandcode.ai";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommandCodeAuth {
    api_key: String,
}

pub(crate) async fn fetch_command_code_usage() -> Option<ProviderLimitStatus> {
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

    super::command_code_projection::command_code_usage_snapshot(
        &credits,
        &subscription,
        &summary,
        current_timestamp(),
    )
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

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}
