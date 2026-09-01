use super::super::super::{pty::PtyState, remote_auth::RemoteAuth, remote_devices::DeviceRegistry};
use super::super::auth::{remote_password_login_response, remote_password_setup_response};
use super::super::http::{
    authorize_remote_http_request, is_idle_client_read_error, is_legacy_remote_terminal_path,
    is_remote_websocket_origin_allowed, is_remote_websocket_upgrade, json_error,
    prepare_client_stream, query_number, read_http_request, remote_asset_response,
    remote_fallback_response, remote_json_error_response, remote_session_id, remote_state_response,
    request_method, request_path, write_binary_response, write_text_response,
};
use super::super::providers::remote_providers_response;
use super::super::runtime::{
    close_remote_session, create_remote_session, pty_snapshot_response, remote_folders_response,
    remote_session_input, remote_session_resize, stream_pty_events, stream_remote_events,
};
use super::super::sessions::{RemoteRuntime, RemoteRuntimeSessionInfo};
use super::super::websocket::{handle_remote_device_websocket, handle_remote_websocket};
use super::super::RemoteResponse;
use std::{
    net::{IpAddr, TcpStream},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

/// Routes one accepted remote connection through the immutable protocol and
/// security seams while listener ownership stays in `server.rs`.
#[allow(clippy::too_many_arguments)]
pub fn handle_connection(
    stream: &mut TcpStream,
    shutdown: Arc<AtomicBool>,
    runtime: Arc<Mutex<RemoteRuntime>>,
    pty_state: PtyState,
    auth: Arc<Mutex<RemoteAuth>>,
    devices: Arc<Mutex<DeviceRegistry>>,
    password_store_path: Arc<PathBuf>,
    remote_ui_dir: Arc<PathBuf>,
) {
    if shutdown.load(Ordering::Relaxed) {
        return;
    }
    if let Err(error) = prepare_client_stream(stream) {
        log::warn!("remote access stream setup failed: {error}");
        return;
    }
    let request = match read_http_request(stream) {
        Ok(request) => request,
        Err(error) if is_idle_client_read_error(&error) => {
            log::debug!("remote access client closed before sending request: {error}");
            return;
        }
        Err(error) => {
            log::warn!("remote access request read failed: {error}");
            return;
        }
    };
    if request.is_empty() {
        return;
    }

    if is_remote_websocket_upgrade(&request) {
        let Some(websocket_path) = request_path(&request).and_then(|path| path.split('?').next())
        else {
            return;
        };
        if !matches!(websocket_path, "/api/remote/ws" | "/api/remote/device/ws") {
            write_text_response(
                stream,
                "404 Not Found",
                "application/json; charset=utf-8",
                &json_error("websocket endpoint not found"),
            );
            return;
        }
        if !is_remote_websocket_origin_allowed(&request) {
            write_text_response(
                stream,
                "403 Forbidden",
                "application/json; charset=utf-8",
                &json_error("websocket origin is not allowed"),
            );
            return;
        }
        if websocket_path == "/api/remote/ws" {
            let client_ip = stream
                .peer_addr()
                .map(|address| address.ip())
                .unwrap_or(IpAddr::from([127, 0, 0, 1]));
            handle_remote_websocket(stream, &request, runtime, auth, client_ip);
        } else {
            handle_remote_device_websocket(stream, &request, runtime, devices);
        }
        return;
    }

    if request_path(&request).is_some_and(|path| path.split('?').next() == Some("/healthz")) {
        write_text_response(
            stream,
            "200 OK",
            "application/json; charset=utf-8",
            "{\"ok\":true,\"service\":\"cmdspace-remote\"}\n",
        );
        return;
    }

    let path = request_path(&request).unwrap_or("/");
    let clean_path = path.split('?').next().unwrap_or(path);
    if clean_path == "/api/remote/auth/status" && request_method(&request) == Some("GET") {
        let password_configured = auth
            .lock()
            .map(|auth| auth.password_configured())
            .unwrap_or(false);
        let body = serde_json::json!({ "passwordConfigured": password_configured }).to_string();
        write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body);
        return;
    }

    if clean_path == "/api/remote/auth/setup" && request_method(&request) == Some("POST") {
        let client_ip = stream
            .peer_addr()
            .map(|address| address.ip())
            .unwrap_or(IpAddr::from([127, 0, 0, 1]));
        match remote_password_setup_response(
            &request,
            &auth,
            client_ip,
            password_store_path.as_ref(),
        ) {
            Ok(body) => {
                write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body)
            }
            Err(error) => write_text_response(
                stream,
                "401 Unauthorized",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }

    if clean_path == "/api/remote/auth/login" && request_method(&request) == Some("POST") {
        let client_ip = stream
            .peer_addr()
            .map(|address| address.ip())
            .unwrap_or(IpAddr::from([127, 0, 0, 1]));
        match remote_password_login_response(&request, &auth, client_ip) {
            Ok(body) => {
                write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body)
            }
            Err(error) => write_text_response(
                stream,
                "401 Unauthorized",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }

    if clean_path.starts_with("/api/remote/") {
        let client_ip = stream
            .peer_addr()
            .map(|address| address.ip())
            .unwrap_or(IpAddr::from([127, 0, 0, 1]));
        if let Err(error) = authorize_remote_http_request(&request, &auth, client_ip) {
            write_text_response(
                stream,
                "401 Unauthorized",
                "application/json; charset=utf-8",
                &json_error(&error),
            );
            return;
        }
    }

    if clean_path == "/api/remote/state" {
        let response =
            remote_state_response().unwrap_or_else(|error| remote_json_error_response(&error));
        write_binary_response(stream, &response);
        return;
    }
    if clean_path == "/api/remote/providers" {
        let response =
            remote_providers_response().unwrap_or_else(|error| remote_json_error_response(&error));
        write_binary_response(stream, &response);
        return;
    }
    if is_legacy_remote_terminal_path(clean_path) {
        write_text_response(
            stream,
            "410 Gone",
            "application/json; charset=utf-8",
            &json_error("terminal HTTP transport has moved to /api/remote/ws"),
        );
        return;
    }
    if clean_path == "/api/remote/sessions" {
        let response = serde_json::to_string(&pty_state.list_sessions())
            .map_err(|error| error.to_string())
            .map(|body| RemoteResponse {
                status: "200 OK",
                content_type: "application/json; charset=utf-8",
                body: body.into_bytes(),
            })
            .unwrap_or_else(|error| remote_json_error_response(&error));
        write_binary_response(stream, &response);
        return;
    }
    if clean_path == "/api/remote/runtime/sessions" {
        let sessions = runtime
            .lock()
            .map(|guard| {
                guard
                    .sessions
                    .iter()
                    .map(|(id, session)| RemoteRuntimeSessionInfo {
                        id: *id,
                        title: "Remote terminal".to_string(),
                        cwd: session.cwd.clone(),
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let body = serde_json::to_string(&sessions).unwrap_or_else(|_| "[]".to_string());
        write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body);
        return;
    }
    if clean_path == "/api/remote/folders" {
        match remote_folders_response(path) {
            Ok(body) => {
                write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body)
            }
            Err(error) => write_text_response(
                stream,
                "400 Bad Request",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }
    if clean_path == "/api/remote/session" && request_method(&request) == Some("POST") {
        match create_remote_session(&request, &runtime) {
            Ok(body) => {
                write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body)
            }
            Err(error) => write_text_response(
                stream,
                "400 Bad Request",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }
    if let Some(id) = remote_session_id(clean_path, "/events") {
        stream_remote_events(
            stream,
            &runtime,
            id,
            query_number(path, "after").unwrap_or(0),
        );
        return;
    }
    if let Some(id) = remote_session_id(clean_path, "/attach/events") {
        stream_pty_events(stream, &pty_state, id);
        return;
    }
    if let Some(id) = remote_session_id(clean_path, "/snapshot") {
        match pty_snapshot_response(&pty_state, id) {
            Ok(body) => {
                write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body)
            }
            Err(error) => write_text_response(
                stream,
                "404 Not Found",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }
    if let Some(id) = remote_session_id(clean_path, "/input") {
        match remote_session_input(&request, &runtime, &pty_state, id) {
            Ok(()) => write_text_response(stream, "204 No Content", "text/plain", ""),
            Err(error) => write_text_response(
                stream,
                "400 Bad Request",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }
    if let Some(id) = remote_session_id(clean_path, "/resize") {
        match remote_session_resize(&request, &runtime, &pty_state, id) {
            Ok(()) => write_text_response(stream, "204 No Content", "text/plain", ""),
            Err(error) => write_text_response(
                stream,
                "400 Bad Request",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }
    if let Some(id) = remote_session_id(clean_path, "/close") {
        close_remote_session(&runtime, id);
        write_text_response(stream, "204 No Content", "text/plain", "");
        return;
    }

    let response = remote_asset_response(path, remote_ui_dir.as_ref())
        .unwrap_or_else(|error| remote_fallback_response(&error));
    write_binary_response(stream, &response);
}
