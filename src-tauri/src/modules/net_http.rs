use std::collections::HashMap;

use bytes::Bytes;
use futures_util::StreamExt;
use reqwest::header::HeaderMap;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

use super::security::{
    build_safe_client, classify_and_collect_safe_ips, sanitize_headers, validate_url,
};

#[derive(Debug, Serialize)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
}

fn build_request(
    client: &reqwest::Client,
    method: &str,
    url: reqwest::Url,
    headers: Option<HashMap<String, String>>,
    body: Option<Vec<u8>>,
) -> Result<reqwest::RequestBuilder, String> {
    let method = Method::from_bytes(method.as_bytes()).map_err(|e| e.to_string())?;
    let mut req = client.request(method, url);
    req = req.headers(sanitize_headers(headers)?);
    if let Some(body) = body {
        req = req.body(body);
    }
    Ok(req)
}

fn header_map_to_strings(headers: &HeaderMap) -> HashMap<String, String> {
    let mut out = HashMap::with_capacity(headers.len());
    for (key, value) in headers {
        if let Ok(value) = value.to_str() {
            out.insert(key.as_str().to_ascii_lowercase(), value.to_string());
        }
    }
    out
}

#[tauri::command]
pub async fn ai_http_request(
    url: String,
    method: String,
    headers: Option<HashMap<String, String>>,
    body: Option<Vec<u8>>,
    allow_private_network: Option<bool>,
) -> Result<HttpResponse, String> {
    let allow_private = allow_private_network.unwrap_or(false);
    let parsed = validate_url(&url, allow_private)?;
    let host = parsed
        .host_str()
        .ok_or_else(|| "missing host".to_string())?
        .to_string();
    let safe_ips = classify_and_collect_safe_ips(&host, allow_private).await?;

    let client = build_safe_client(allow_private, &[(host, safe_ips)])?;
    let req = build_request(&client, &method, parsed, headers, body)?;
    let resp = req.send().await.map_err(|e| e.to_string())?;

    let status = resp.status().as_u16();
    let headers = header_map_to_strings(resp.headers());
    let body = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();
    Ok(HttpResponse {
        status,
        headers,
        body,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AiStreamEvent {
    Headers {
        status: u16,
        headers: HashMap<String, String>,
    },
    Chunk {
        bytes: Vec<u8>,
    },
    End,
    Error {
        message: String,
    },
}

#[tauri::command]
pub async fn ai_http_stream(
    url: String,
    method: String,
    headers: Option<HashMap<String, String>>,
    body: Option<Vec<u8>>,
    allow_private_network: Option<bool>,
    on_event: Channel<AiStreamEvent>,
) -> Result<(), String> {
    let allow_private = allow_private_network.unwrap_or(false);
    let parsed = match validate_url(&url, allow_private) {
        Ok(parsed) => parsed,
        Err(error) => {
            let _ = on_event.send(AiStreamEvent::Error {
                message: error.clone(),
            });
            return Err(error);
        }
    };
    let host = match parsed.host_str() {
        Some(host) => host.to_string(),
        None => {
            let error = "missing host".to_string();
            let _ = on_event.send(AiStreamEvent::Error {
                message: error.clone(),
            });
            return Err(error);
        }
    };
    let safe_ips = match classify_and_collect_safe_ips(&host, allow_private).await {
        Ok(ips) => ips,
        Err(error) => {
            let _ = on_event.send(AiStreamEvent::Error {
                message: error.clone(),
            });
            return Err(error);
        }
    };

    let client = build_safe_client(allow_private, &[(host, safe_ips)])?;
    let req = build_request(&client, &method, parsed, headers, body)?;
    let resp = match req.send().await {
        Ok(response) => response,
        Err(error) => {
            let message = error.to_string();
            let _ = on_event.send(AiStreamEvent::Error {
                message: message.clone(),
            });
            return Err(message);
        }
    };

    let status = resp.status().as_u16();
    let response_headers = header_map_to_strings(resp.headers());
    let _ = on_event.send(AiStreamEvent::Headers {
        status,
        headers: response_headers,
    });

    let mut stream = resp.bytes_stream();
    while let Some(item) = stream.next().await {
        match item {
            Ok(chunk) => {
                let bytes: Bytes = chunk;
                if on_event
                    .send(AiStreamEvent::Chunk {
                        bytes: bytes.to_vec(),
                    })
                    .is_err()
                {
                    return Ok(());
                }
            }
            Err(error) => {
                let message = error.to_string();
                let _ = on_event.send(AiStreamEvent::Error {
                    message: message.clone(),
                });
                return Err(message);
            }
        }
    }

    let _ = on_event.send(AiStreamEvent::End);
    Ok(())
}
