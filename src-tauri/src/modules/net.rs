use std::net::SocketAddr;
use std::time::Duration;

#[path = "net_error.rs"]
mod error;
#[path = "net_security.rs"]
mod security;
use error::NetErrorKind;
pub use error::{NetError, NetResult};
use security::{classify_and_collect_safe_ips, validate_url};
#[path = "net_http.rs"]
mod http;
pub use http::{__cmd__ai_http_request, __cmd__ai_http_stream, ai_http_request, ai_http_stream};
// Preserve the response/event types at their historical net facade paths.
#[allow(unused_imports)]
pub use http::{AiStreamEvent, HttpResponse};

#[tauri::command]
pub async fn lm_ping(base_url: String) -> NetResult<u16> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err(NetError::new(NetErrorKind::EmptyUrl));
    }
    let probe = format!("{trimmed}/models");
    let parsed = validate_url(&probe, true)?;
    let host = parsed
        .host_str()
        .ok_or_else(|| NetError::new(NetErrorKind::MissingHost))?
        .to_string();
    let safe_ips = classify_and_collect_safe_ips(&host, true).await?;

    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::none());
    let addrs: Vec<SocketAddr> = safe_ips.iter().map(|ip| SocketAddr::new(*ip, 0)).collect();
    builder = builder.resolve_to_addrs(&host, &addrs);
    let client = builder
        .build()
        .map_err(|_| NetError::new(NetErrorKind::ClientBuildFailed))?;
    client
        .get(parsed)
        .send()
        .await
        .map(|r| r.status().as_u16())
        .map_err(|_| NetError::new(NetErrorKind::RequestFailed))
}
