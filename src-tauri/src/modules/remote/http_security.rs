use crate::modules::remote_auth::{now_unix_seconds, RemoteAuth, RemoteAuthError};
use std::net::IpAddr;
use std::sync::{Arc, Mutex};

pub fn is_remote_websocket_upgrade(request: &[u8]) -> bool {
    let Some(path) = super::request_path(request) else {
        return false;
    };
    if !matches!(
        path.split('?').next(),
        Some("/api/remote/ws" | "/api/remote/device/ws")
    ) || super::request_method(request) != Some("GET")
    {
        return false;
    }
    let headers = std::str::from_utf8(request)
        .ok()
        .and_then(|request| request.split_once("\r\n\r\n").map(|(headers, _)| headers));
    let Some(headers) = headers else {
        return false;
    };
    let mut has_upgrade = false;
    let mut has_connection_upgrade = false;
    let mut has_key = false;
    for line in headers.lines().skip(1) {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        match name.trim().to_ascii_lowercase().as_str() {
            "upgrade" => has_upgrade = value.trim().eq_ignore_ascii_case("websocket"),
            "connection" => {
                has_connection_upgrade = value
                    .split(',')
                    .any(|token| token.trim().eq_ignore_ascii_case("upgrade"));
            }
            "sec-websocket-key" => has_key = !value.trim().is_empty(),
            _ => {}
        }
    }
    has_upgrade && has_connection_upgrade && has_key
}

pub fn is_remote_websocket_origin_allowed(request: &[u8]) -> bool {
    let Some(origin) = request_header(request, "Origin") else {
        return true;
    };
    let Some(host) = request_header(request, "Host") else {
        return false;
    };
    let Some(origin_host) = origin
        .strip_prefix("http://")
        .or_else(|| origin.strip_prefix("https://"))
    else {
        return false;
    };
    !origin_host.contains('/') && origin_host.eq_ignore_ascii_case(host)
}

pub fn request_header<'a>(request: &'a [u8], header_name: &str) -> Option<&'a str> {
    let text = std::str::from_utf8(request).ok()?;
    let headers = text.split_once("\r\n\r\n").map(|(headers, _)| headers)?;
    headers.lines().skip(1).find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.trim()
            .eq_ignore_ascii_case(header_name)
            .then_some(value.trim())
    })
}

pub fn remote_bearer_token(request: &[u8]) -> Option<&str> {
    request_header(request, "Authorization")?
        .strip_prefix("Bearer ")
        .filter(|token| !token.is_empty())
}

pub fn authorize_remote_http_request(
    request: &[u8],
    auth: &Arc<Mutex<RemoteAuth>>,
    client_ip: IpAddr,
) -> Result<(), String> {
    let now = now_unix_seconds();
    let token =
        remote_bearer_token(request).ok_or_else(|| "authentication required".to_string())?;
    let mut auth = auth
        .lock()
        .map_err(|_| "remote auth state poisoned".to_string())?;
    if !auth.allow_auth_attempt(client_ip, now) {
        return Err(RemoteAuthError::RateLimited.to_string());
    }
    match auth.verify_session_token(token, now) {
        Ok(_) => Ok(()),
        Err(error) => {
            auth.record_failed_auth_attempt(client_ip, now);
            Err(error.to_string())
        }
    }
}

pub fn is_legacy_remote_terminal_path(path: &str) -> bool {
    matches!(
        path,
        "/api/remote/sessions" | "/api/remote/runtime/sessions" | "/api/remote/session"
    ) || path.starts_with("/api/remote/session/")
}
