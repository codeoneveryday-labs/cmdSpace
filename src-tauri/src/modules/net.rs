use std::net::SocketAddr;
use std::time::Duration;

#[path = "net_security.rs"]
mod security;
use security::{classify_and_collect_safe_ips, validate_url};
#[path = "net_http.rs"]
mod http;
pub use http::{__cmd__ai_http_request, __cmd__ai_http_stream, ai_http_request, ai_http_stream};
// Preserve the response/event types at their historical net facade paths.
#[allow(unused_imports)]
pub use http::{AiStreamEvent, HttpResponse};

#[tauri::command]
pub async fn lm_ping(base_url: String) -> Result<u16, String> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("empty base url".into());
    }
    let probe = format!("{trimmed}/models");
    let parsed = validate_url(&probe, true)?;
    let host = parsed
        .host_str()
        .ok_or_else(|| "missing host".to_string())?
        .to_string();
    let safe_ips = classify_and_collect_safe_ips(&host, true).await?;

    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::none());
    let addrs: Vec<SocketAddr> = safe_ips.iter().map(|ip| SocketAddr::new(*ip, 0)).collect();
    builder = builder.resolve_to_addrs(&host, &addrs);
    let client = builder.build().map_err(|e| e.to_string())?;
    client
        .get(parsed)
        .send()
        .await
        .map(|r| r.status().as_u16())
        .map_err(|e| e.to_string())
}
