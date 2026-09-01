use super::super::remote_auth::RemoteAuth;
use super::super::remote_devices::DeviceRegistry;
use super::super::remote_protocol::{
    ClientMessage, DeviceClientMessage, DeviceServerMessage, RemoteClientEnvelope,
    RemoteDeviceClientEnvelope, RemoteDeviceServerEnvelope, RemoteServerEnvelope, ServerMessage,
};
use super::super::remote_relay::RemoteRelayIdentity;
use super::http::{
    desktop_session_id, is_legacy_remote_terminal_path, is_remote_websocket_origin_allowed,
    is_remote_websocket_upgrade, query_number, read_http_request, remote_asset_response,
    remote_fallback_response, remote_session_id,
};
use super::http::{
    development_remote_ui_dir, prepare_client_stream, remote_bearer_token, remote_state_response,
    remote_ui_dir_from,
};
use super::runtime::{
    authorize_remote_cwd, build_remote_shell_command, close_remote_session,
    remote_folders_response, spawn_remote_terminal, strip_verbatim_prefix,
};
use super::server::{handle_connection, select_lan_ip};
use super::sessions::{RemoteOutput, RemoteRuntime, REMOTE_SESSION_ID_START};
use super::state::{status_with_tunnel, RemoteServer};
use super::websocket::runtime_output_is_live;
use super::*;
use crate::modules::remote_auth::now_unix_seconds;
use crate::pty::PtyState;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use ed25519_dalek::{Signer, SigningKey};
use std::time::Instant;
use std::{
    collections::{HashMap, VecDeque},
    fs,
    io::{Read, Write},
    net::{IpAddr, SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    sync::{atomic::AtomicBool, Arc, Mutex},
    thread,
    time::Duration,
};
use tungstenite::{Message, WebSocket};

#[test]
fn remote_client_stream_reads_delayed_request_after_nonblocking_accept() {
    let listener = TcpListener::bind((IpAddr::from([127, 0, 0, 1]), 0)).unwrap();
    listener.set_nonblocking(true).unwrap();
    let addr = listener.local_addr().unwrap();

    let writer = thread::spawn(move || {
        let mut client = TcpStream::connect(addr).unwrap();
        thread::sleep(Duration::from_millis(75));
        client
            .write_all(b"GET / HTTP/1.1\r\nHost: localhost\r\n\r\n")
            .unwrap();
    });

    let start = Instant::now();
    let mut accepted = loop {
        match listener.accept() {
            Ok((stream, _)) => break stream,
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if start.elapsed() > Duration::from_secs(2) {
                    panic!("timed out waiting for test client");
                }
                thread::sleep(Duration::from_millis(10));
            }
            Err(e) => panic!("accept failed: {e}"),
        }
    };

    prepare_client_stream(&accepted).unwrap();
    let request = read_http_request(&mut accepted).unwrap();
    writer.join().unwrap();

    assert!(request.starts_with(b"GET / HTTP/1.1\r\n"));
    assert!(request.ends_with(b"\r\n\r\n"));
}

#[test]
fn remote_asset_response_serves_react_bundle_from_dist() {
    let dir = tempfile::tempdir().unwrap();
    let assets = dir.path().join("assets");
    fs::create_dir(&assets).unwrap();
    fs::write(
        dir.path().join("remote.html"),
        r#"<!doctype html><div id="remote-root"></div><script src="/assets/remote.js"></script>"#,
    )
    .unwrap();
    fs::write(assets.join("remote.js"), "console.log('remote bundle')").unwrap();

    let html = remote_asset_response("/", dir.path()).unwrap();
    assert_eq!(html.content_type, "text/html; charset=utf-8");
    assert!(String::from_utf8(html.body)
        .unwrap()
        .contains("remote-root"));

    let js = remote_asset_response("/assets/remote.js", dir.path()).unwrap();
    assert_eq!(js.content_type, "text/javascript; charset=utf-8");
    assert!(String::from_utf8(js.body)
        .unwrap()
        .contains("remote bundle"));
}

#[test]
fn packaged_builds_bundle_the_remote_ui_as_a_named_resource() {
    let config: serde_json::Value = serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tauri.conf.json"
    )))
    .unwrap();

    assert_eq!(config["bundle"]["resources"]["../dist"], "remote-ui");
}

#[test]
fn remote_ui_dir_prefers_the_packaged_bundle() {
    let dir = tempfile::tempdir().unwrap();
    let resources = dir.path().join("resources");
    let packaged = resources.join("remote-ui");
    fs::create_dir_all(&packaged).unwrap();
    fs::write(packaged.join("remote.html"), "remote ui").unwrap();

    let resolved = remote_ui_dir_from(Some(&resources), dir.path());

    assert_eq!(resolved, packaged);
}

#[test]
fn development_remote_ui_dir_ignores_stale_packaged_resources() {
    let dir = tempfile::tempdir().unwrap();
    let stale_resources = dir.path().join("resources/remote-ui");
    let workspace_dist = dir.path().join("dist");
    fs::create_dir_all(&stale_resources).unwrap();
    fs::create_dir_all(&workspace_dist).unwrap();
    fs::write(stale_resources.join("remote.html"), "stale remote ui").unwrap();
    fs::write(workspace_dist.join("remote.html"), "fresh remote ui").unwrap();

    let resolved =
        development_remote_ui_dir(Some(dir.path().join("resources").as_path()), dir.path());

    assert_eq!(resolved, workspace_dist);
}

#[test]
fn remote_asset_response_rejects_path_traversal() {
    let dir = tempfile::tempdir().unwrap();
    let error = remote_asset_response("/../Cargo.toml", dir.path()).unwrap_err();

    assert!(error.contains("invalid"));
}

#[test]
fn remote_fallback_response_explains_missing_bundle() {
    let response = remote_fallback_response("missing <remote>");
    let body = String::from_utf8(response.body).unwrap();

    assert_eq!(response.content_type, "text/html; charset=utf-8");
    assert!(body.contains("Remote UI bundle is not built"));
    assert!(body.contains("missing &lt;remote&gt;"));
}

#[test]
fn remote_health_endpoint_returns_json() {
    let remote_listener = TcpListener::bind((IpAddr::from([127, 0, 0, 1]), 0)).unwrap();
    remote_listener.set_nonblocking(true).unwrap();
    let remote_addr = remote_listener.local_addr().unwrap();
    let client_thread = thread::spawn(move || {
        let mut client = TcpStream::connect(remote_addr).unwrap();
        client
            .write_all(b"GET /healthz HTTP/1.1\r\nHost: remote\r\n\r\n")
            .unwrap();
        let mut response = String::new();
        client.read_to_string(&mut response).unwrap();
        response
    });

    let start = Instant::now();
    let mut accepted = loop {
        match remote_listener.accept() {
            Ok((stream, _)) => break stream,
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if start.elapsed() > Duration::from_secs(2) {
                    panic!("timed out waiting for remote health test client");
                }
                thread::sleep(Duration::from_millis(10));
            }
            Err(e) => panic!("accept failed: {e}"),
        }
    };

    handle_connection(
        &mut accepted,
        Arc::new(AtomicBool::new(false)),
        Arc::new(Mutex::new(RemoteRuntime {
            id: 1,
            next_id: 1,
            sessions: HashMap::new(),
        })),
        PtyState::default(),
        Arc::new(Mutex::new(RemoteAuth::new().unwrap().0)),
        Arc::new(Mutex::new(DeviceRegistry::new_for_test([0; 32]))),
        Arc::new(std::env::temp_dir().join("cmdspace-remote-health-password.txt")),
        Arc::new(std::env::temp_dir()),
    );
    drop(accepted);
    let response = client_thread.join().unwrap();

    assert!(response.starts_with("HTTP/1.1 200 OK\r\n"));
    assert!(response.contains("\"ok\":true"));
    assert!(response.contains("cmdspace-remote"));
}

#[test]
fn remote_http_reader_keeps_json_body_after_headers() {
    let listener = TcpListener::bind((IpAddr::from([127, 0, 0, 1]), 0)).unwrap();
    let address = listener.local_addr().unwrap();
    let writer = thread::spawn(move || {
        let mut client = TcpStream::connect(address).unwrap();
        client
                .write_all(b"POST /api/remote/session/1/input HTTP/1.1\r\nContent-Length: 12\r\n\r\n{\"data\":\"x\"}")
                .unwrap();
    });
    let (mut client, _) = listener.accept().unwrap();
    let request = read_http_request(&mut client).unwrap();
    writer.join().unwrap();
    assert!(String::from_utf8(request)
        .unwrap()
        .ends_with("{\"data\":\"x\"}"));
}

#[test]
fn remote_session_paths_keep_query_parameters_separate() {
    let path = "/api/remote/session/42/events?after=7&token=secret";
    assert_eq!(
        path.split('?').next(),
        Some("/api/remote/session/42/events")
    );
    assert_eq!(
        remote_session_id(path.split('?').next().unwrap(), "/events"),
        Some(42)
    );
    assert_eq!(query_number(path, "after"), Some(7));
}

#[test]
fn remote_state_response_returns_workspace_rows() {
    let conn = db::init_db().unwrap();
    conn.execute("DELETE FROM workspaces", []).unwrap();
    conn.execute("DELETE FROM recent_workspaces", []).unwrap();
    db::save_workspace_inner(
        &conn,
        &db::WorkspaceRow {
            id: "workspace-remote".to_string(),
            name: "Remote Workspace".to_string(),
            count: 4,
            accent_color: Some("#10B981".to_string()),
            working_folder: Some("/tmp/cmdspace-test-workspace".to_string()),
            created_at: 1,
            updated_at: 2,
            display_order: 0,
            pane_layout: None,
            workspace_mode: Some("canvas".to_string()),
            agent_provider: None,
            agent_session_id: None,
            agent_providers: None,
            agent_session_ids: None,
            agent_chat_ids: None,
        },
    )
    .unwrap();
    db::save_recent_workspace_inner(
        &conn,
        &db::RecentWorkspaceRow {
            id: "recent-remote".to_string(),
            name: "Recent Remote".to_string(),
            count: 2,
            working_folder: "/tmp/cmdspace-test-recent".to_string(),
            updated_at: 3,
        },
    )
    .unwrap();
    drop(conn);

    let response = remote_state_response().unwrap();
    let body = String::from_utf8(response.body).unwrap();

    assert_eq!(response.status, "200 OK");
    assert_eq!(response.content_type, "application/json; charset=utf-8");
    assert!(body.contains("\"workspaces\""));
    assert!(body.contains("\"recentWorkspaces\""));
    assert!(body.contains("\"hostname\""));
    assert!(body.contains("\"Remote Workspace\""));
    assert!(body.contains("\"accentColor\":\"#10B981\""));
}

#[test]
fn authorize_remote_cwd_accepts_path_inside_home() {
    let Some(home) = dirs::home_dir() else {
        return;
    };
    let inside = tempfile::Builder::new()
        .prefix("cmdspace-remote-home-test")
        .tempdir_in(&home)
        .expect("tempdir inside home");
    let inner = inside.path().to_string_lossy().into_owned();

    let authorized = authorize_remote_cwd(Some(&inner)).unwrap();
    let expected = fs::canonicalize(inside.path())
        .unwrap()
        .to_string_lossy()
        .into_owned();
    assert_eq!(authorized, Some(expected));
}

#[test]
fn authorize_remote_cwd_rejects_path_outside_home() {
    let foreign = tempfile::tempdir().unwrap();
    let outer = foreign.path().to_string_lossy().into_owned();

    let rejected = authorize_remote_cwd(Some(&outer)).unwrap_err();
    assert!(rejected.contains("inside the user home"), "got: {rejected}");
}

#[test]
fn strip_verbatim_prefix_normalizes_windows_and_unix_paths() {
    assert_eq!(
        strip_verbatim_prefix(Path::new(r"\\?\C:\Users\dev\repo")),
        PathBuf::from(r"C:\Users\dev\repo")
    );
    assert_eq!(
        strip_verbatim_prefix(Path::new("/home/dev/repo")),
        PathBuf::from("/home/dev/repo")
    );
}

#[test]
fn authorize_remote_cwd_rejects_missing_path() {
    let missing =
        std::env::temp_dir().join(format!("cmdspace-remote-missing-{}", std::process::id()));
    let error = authorize_remote_cwd(missing.to_str()).unwrap_err();
    assert!(error.contains("not accessible"), "got: {error}");
}

#[test]
fn authorize_remote_cwd_accepts_none() {
    assert_eq!(authorize_remote_cwd(None).unwrap(), None);
}

#[test]
fn websocket_upgrade_request_requires_remote_gateway_path_and_headers() {
    let request = b"GET /api/remote/ws HTTP/1.1\r\nHost: localhost\r\nConnection: keep-alive, Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n";

    assert!(is_remote_websocket_upgrade(request));
    assert!(!is_remote_websocket_upgrade(
        b"GET /api/remote/ws HTTP/1.1\r\nHost: localhost\r\n\r\n"
    ));
    assert!(!is_remote_websocket_upgrade(
        b"GET /api/remote/state HTTP/1.1\r\nUpgrade: websocket\r\nSec-WebSocket-Key: key\r\n\r\n"
    ));
}

#[test]
fn websocket_upgrade_rejects_a_cross_origin_browser_request() {
    let request = b"GET /api/remote/ws HTTP/1.1\r\nHost: 192.168.1.8:53631\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: key\r\nOrigin: https://attacker.example\r\n\r\n";

    assert!(!is_remote_websocket_origin_allowed(request));
}

#[test]
fn remote_runtime_session_ids_do_not_overlap_desktop_pty_ids() {
    assert!(REMOTE_SESSION_ID_START > u32::MAX as u64);
    assert_eq!(desktop_session_id(u32::MAX as u64), Ok(u32::MAX));
    assert!(desktop_session_id(REMOTE_SESSION_ID_START).is_err());
}

#[test]
fn remote_websocket_session_list_excludes_desktop_ptys() {
    let source = include_str!("websocket.rs");
    let start = source
        .find("fn send_remote_sessions(")
        .expect("remote session list function");
    let end = source[start..]
        .find("fn drain_remote_websocket_output(")
        .map(|offset| start + offset)
        .expect("next remote websocket function");

    assert!(
        !source[start..end].contains(".list_sessions()"),
        "the remote UI must never attach a desktop terminal by matching its cwd"
    );
}

#[test]
fn native_device_session_list_never_hydrates_desktop_workspace_panes() {
    let source = include_str!("device_views.rs");
    let start = source
        .find("fn send_remote_device_sessions(")
        .expect("native session list function");
    let end = source[start..]
        .find("fn remote_protocol_sessions_for_device(")
        .map(|offset| start + offset)
        .expect("native device session projection");
    let projection = &source[start..end];

    assert!(!projection.contains("hydrate_workspace_panes"));
    assert!(!projection.contains("workspace_panes"));
    assert!(!projection.contains("last_command"));
}

#[test]
fn remote_websocket_commands_only_target_remote_runtime_sessions() {
    let source = include_str!("websocket.rs");
    let start = source
        .find("fn handle_remote_websocket_message(")
        .expect("remote WebSocket command handler");
    let end = source[start..]
        .find("fn send_remote_sessions(")
        .map(|offset| start + offset)
        .expect("remote session list function");
    let handler = &source[start..end];

    assert!(
        !handler.contains("desktop_session_id"),
        "remote WebSocket commands must not fall back to desktop PTYs"
    );
    assert!(
        !handler.contains("pty_state."),
        "remote WebSocket commands must only use their own runtime PTYs"
    );
}

#[test]
fn remote_terminal_spawns_in_an_authorized_directory() {
    let cwd = dirs::home_dir()
        .expect("home directory")
        .to_string_lossy()
        .into_owned();
    let terminal =
        spawn_remote_terminal(Some(cwd), None, None).expect("remote terminal should spawn");

    let deadline = std::time::Instant::now() + Duration::from_secs(3);
    let mut output = terminal.output.lock().expect("remote terminal output");
    while output.chunks.is_empty() && !output.exited && std::time::Instant::now() < deadline {
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        let (next, _) = terminal
            .changed
            .wait_timeout(output, remaining)
            .expect("wait for remote terminal output");
        output = next;
    }
    assert!(
        !output.chunks.is_empty(),
        "remote shell should publish its initial prompt"
    );
    drop(output);

    terminal
        .killer
        .lock()
        .expect("remote terminal killer")
        .kill()
        .expect("remote terminal should stop");
}

#[cfg(unix)]
#[test]
fn remote_shell_is_a_clean_login_shell_without_desktop_integration() {
    let cwd = dirs::home_dir()
        .expect("home directory")
        .to_string_lossy()
        .into_owned();
    let command =
        build_remote_shell_command(Some(cwd.clone())).expect("remote command should build");

    assert!(command.get_argv().iter().any(|arg| arg == "-l"));
    assert!(command.get_argv().iter().any(|arg| arg == "-i"));
    assert_eq!(
        command.get_cwd().map(|path| path.to_string_lossy()),
        Some(cwd.into())
    );
    assert_eq!(command.get_env("CMDSPACE_TERMINAL"), None);
    assert_eq!(command.get_env("CMDSPACE_USER_ZDOTDIR"), None);
    assert_eq!(command.get_env("ZDOTDIR"), None);
}

#[test]
fn remote_terminal_writes_input_and_emits_the_shell_response() {
    let cwd = dirs::home_dir()
        .expect("home directory")
        .to_string_lossy()
        .into_owned();
    let terminal =
        spawn_remote_terminal(Some(cwd), None, None).expect("remote terminal should spawn");

    terminal
        .writer
        .lock()
        .expect("remote terminal writer")
        .write_all(b"printf 'cmdspace-direct-input-ok\\n'\\r")
        .expect("remote terminal should receive input");

    let deadline = std::time::Instant::now() + Duration::from_secs(3);
    let mut output = terminal.output.lock().expect("remote terminal output");
    while !output
        .chunks
        .iter()
        .any(|(_, bytes)| String::from_utf8_lossy(bytes).contains("cmdspace-direct-input-ok"))
        && !output.exited
        && std::time::Instant::now() < deadline
    {
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        let (next, _) = terminal
            .changed
            .wait_timeout(output, remaining)
            .expect("wait for remote terminal output");
        output = next;
    }
    assert!(
        output
            .chunks
            .iter()
            .any(|(_, bytes)| String::from_utf8_lossy(bytes).contains("cmdspace-direct-input-ok")),
        "remote terminal input should be returned through its PTY"
    );
    drop(output);

    terminal
        .killer
        .lock()
        .expect("remote terminal killer")
        .kill()
        .expect("remote terminal should stop");
}

#[test]
fn remote_websocket_creates_attaches_and_streams_a_terminal_prompt() {
    let listener = TcpListener::bind((IpAddr::from([127, 0, 0, 1]), 0)).unwrap();
    let address = listener.local_addr().unwrap();
    let now = now_unix_seconds();
    let (mut remote_auth, bootstrap) = RemoteAuth::new().unwrap();
    remote_auth
        .setup_password(&bootstrap, "remote-test-password", now)
        .unwrap();
    let token = remote_auth
        .authenticate_password("remote-test-password", "test-client", now)
        .unwrap();
    let runtime = Arc::new(Mutex::new(RemoteRuntime {
        id: 1,
        next_id: REMOTE_SESSION_ID_START,
        sessions: HashMap::new(),
    }));
    let server_runtime = Arc::clone(&runtime);
    let server = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        handle_connection(
            &mut stream,
            Arc::new(AtomicBool::new(false)),
            server_runtime,
            PtyState::default(),
            Arc::new(Mutex::new(remote_auth)),
            Arc::new(Mutex::new(DeviceRegistry::new_for_test([0; 32]))),
            Arc::new(std::env::temp_dir().join("cmdspace-remote-ws-test-password")),
            Arc::new(std::env::temp_dir()),
        );
    });

    let stream = TcpStream::connect(address).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    let (mut socket, _) =
        tungstenite::client(format!("ws://{address}/api/remote/ws"), stream).unwrap();
    let read_message = |socket: &mut WebSocket<TcpStream>| {
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        loop {
            match socket.read() {
                Ok(Message::Text(payload)) => {
                    return serde_json::from_str::<RemoteServerEnvelope>(payload.as_ref()).unwrap();
                }
                Ok(_) => panic!("expected a text WebSocket message"),
                Err(tungstenite::Error::Io(error))
                    if matches!(
                        error.kind(),
                        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                    ) && std::time::Instant::now() < deadline =>
                {
                    std::thread::sleep(Duration::from_millis(10));
                }
                Err(error) => panic!("remote WebSocket message: {error:?}"),
            }
        }
    };
    let send_message = |socket: &mut WebSocket<TcpStream>, message| {
        let payload = serde_json::to_string(&RemoteClientEnvelope::new(message)).unwrap();
        socket.send(Message::text(payload)).unwrap();
    };

    assert!(matches!(
        read_message(&mut socket).message,
        ServerMessage::Hello { .. }
    ));
    send_message(&mut socket, ClientMessage::Auth { token });
    assert_eq!(
        read_message(&mut socket).message,
        ServerMessage::Authenticated
    );
    assert!(matches!(
        read_message(&mut socket).message,
        ServerMessage::ProvidersSnapshot { .. }
    ));
    let cwd = dirs::home_dir()
        .expect("home directory")
        .to_string_lossy()
        .into_owned();
    send_message(
        &mut socket,
        ClientMessage::CreateSession {
            cwd: Some(cwd),
            workspace_id: None,
        },
    );
    let ServerMessage::Sessions { sessions } = read_message(&mut socket).message else {
        panic!("expected the created remote session");
    };
    let session_id = sessions
        .into_iter()
        .find(|session| session.id >= REMOTE_SESSION_ID_START)
        .expect("runtime remote session")
        .id;
    send_message(
        &mut socket,
        ClientMessage::CreateSession {
            cwd: dirs::home_dir().map(|path| path.to_string_lossy().into_owned()),
            workspace_id: None,
        },
    );
    let ServerMessage::Sessions { sessions } = read_message(&mut socket).message else {
        panic!("expected sessions after duplicate create");
    };
    assert_eq!(
        sessions
            .iter()
            .filter(|session| session.id >= REMOTE_SESSION_ID_START)
            .count(),
        1,
        "retries must not spawn duplicate remote shells",
    );
    send_message(
        &mut socket,
        ClientMessage::Attach {
            session_id,
            after: 0,
        },
    );
    let mut visible_output = String::new();
    send_message(
        &mut socket,
        ClientMessage::Input {
            session_id,
            data: "printf 'cmdspace-remote-input-ok\\n'\\r".to_string(),
        },
    );
    // A shell prompt's escape sequence varies with the user's shell config.
    // The command echo is the stable protocol-level proof that attach, input,
    // and output streaming work together.
    let input_deadline = std::time::Instant::now() + Duration::from_secs(6);
    while std::time::Instant::now() < input_deadline {
        let output = read_message(&mut socket).message;
        match output {
            ServerMessage::Output { data, .. } => visible_output.push_str(&data),
            ServerMessage::Error { message, .. } => {
                visible_output.push_str("[remote error: ");
                visible_output.push_str(&message);
                visible_output.push(']');
            }
            _ => {}
        }
        if visible_output.contains("cmdspace-remote-input-ok") {
            break;
        }
    }
    assert!(
        visible_output.contains("cmdspace-remote-input-ok"),
        "remote keyboard input should reach its isolated shell; received: {visible_output:?}"
    );

    socket.close(None).unwrap();
    server.join().unwrap();
    close_remote_session(&runtime, session_id);
}

#[test]
fn native_device_websocket_pairs_authenticates_and_lists_remote_sessions() {
    let listener = TcpListener::bind((IpAddr::from([127, 0, 0, 1]), 0)).unwrap();
    let address = listener.local_addr().unwrap();
    let mut registry = DeviceRegistry::new_for_test([7; 32]);
    let grant = registry.issue_grant(
        "cmdSpace iPhone",
        DeviceRegistry::default_native_capability(),
        now_unix_seconds(),
        60,
    );
    let signing_key = SigningKey::from_bytes(&[8; 32]);
    let server_devices = Arc::new(Mutex::new(registry));
    let runtime = Arc::new(Mutex::new(RemoteRuntime {
        id: 1,
        next_id: REMOTE_SESSION_ID_START,
        sessions: HashMap::new(),
    }));
    let server_runtime = Arc::clone(&runtime);
    let server = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        handle_connection(
            &mut stream,
            Arc::new(AtomicBool::new(false)),
            server_runtime,
            PtyState::default(),
            Arc::new(Mutex::new(RemoteAuth::new().unwrap().0)),
            server_devices,
            Arc::new(std::env::temp_dir().join("cmdspace-remote-device-test-password")),
            Arc::new(std::env::temp_dir()),
        );
    });
    let stream = TcpStream::connect(address).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    let (mut socket, _) =
        tungstenite::client(format!("ws://{address}/api/remote/device/ws"), stream).unwrap();
    let read = |socket: &mut WebSocket<TcpStream>| {
        let Message::Text(payload) = socket.read().unwrap() else {
            panic!("expected device text message")
        };
        serde_json::from_str::<RemoteDeviceServerEnvelope>(payload.as_ref()).unwrap()
    };
    let send = |socket: &mut WebSocket<TcpStream>, message| {
        socket
            .send(Message::text(
                serde_json::to_string(&RemoteDeviceClientEnvelope::new(message)).unwrap(),
            ))
            .unwrap();
    };
    let DeviceServerMessage::PairingChallenge { challenge } = read(&mut socket).message else {
        panic!("expected pairing challenge")
    };
    send(
        &mut socket,
        DeviceClientMessage::PairDevice {
            grant_secret: grant.secret.clone(),
            device_name: "cmdSpace iPhone".to_string(),
            public_key: URL_SAFE_NO_PAD.encode(signing_key.verifying_key().to_bytes()),
            proof: URL_SAFE_NO_PAD.encode(signing_key.sign(grant.secret.as_bytes()).to_bytes()),
        },
    );
    send(
        &mut socket,
        DeviceClientMessage::AuthenticateDevice {
            device_id: crate::modules::remote_devices::device_id(
                &signing_key.verifying_key().to_bytes(),
            ),
            proof: URL_SAFE_NO_PAD.encode(signing_key.sign(challenge.as_bytes()).to_bytes()),
        },
    );
    assert!(matches!(
        read(&mut socket).message,
        DeviceServerMessage::DeviceAuthenticated { .. }
    ));
    send(
        &mut socket,
        DeviceClientMessage::Command {
            command: ClientMessage::ListSessions,
        },
    );
    assert!(matches!(
        read(&mut socket).message,
        DeviceServerMessage::Event {
            event: ServerMessage::Sessions { .. }
        }
    ));
    socket.close(None).unwrap();
    server.join().unwrap();
}

#[test]
fn native_device_websocket_reconnects_with_a_fresh_challenge_without_the_qr_grant() {
    let listener = TcpListener::bind((IpAddr::from([127, 0, 0, 1]), 0)).unwrap();
    let address = listener.local_addr().unwrap();
    let signing_key = SigningKey::from_bytes(&[11; 32]);
    let mut registry = DeviceRegistry::new_for_test([12; 32]);
    let grant = registry.issue_grant(
        "cmdSpace iPhone",
        DeviceRegistry::default_native_capability(),
        now_unix_seconds(),
        60,
    );
    let paired = registry
        .consume_grant_with_proof(
            &grant.secret,
            signing_key.verifying_key().to_bytes(),
            signing_key.sign(grant.secret.as_bytes()).to_bytes(),
            now_unix_seconds(),
        )
        .unwrap();
    let server = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        handle_connection(
            &mut stream,
            Arc::new(AtomicBool::new(false)),
            Arc::new(Mutex::new(RemoteRuntime {
                id: 2,
                next_id: REMOTE_SESSION_ID_START,
                sessions: HashMap::new(),
            })),
            PtyState::default(),
            Arc::new(Mutex::new(RemoteAuth::new().unwrap().0)),
            Arc::new(Mutex::new(registry)),
            Arc::new(std::env::temp_dir().join("cmdspace-remote-device-reconnect-password")),
            Arc::new(std::env::temp_dir()),
        );
    });
    let stream = TcpStream::connect(address).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    let (mut socket, _) =
        tungstenite::client(format!("ws://{address}/api/remote/device/ws"), stream).unwrap();
    let Message::Text(payload) = socket.read().unwrap() else {
        panic!("expected device challenge")
    };
    let RemoteDeviceServerEnvelope {
        message: DeviceServerMessage::PairingChallenge { challenge },
        ..
    } = serde_json::from_str(payload.as_ref()).unwrap()
    else {
        panic!("expected pairing challenge")
    };
    let payload = serde_json::to_string(&RemoteDeviceClientEnvelope::new(
        DeviceClientMessage::AuthenticateDevice {
            device_id: paired.id,
            proof: URL_SAFE_NO_PAD.encode(signing_key.sign(challenge.as_bytes()).to_bytes()),
        },
    ))
    .unwrap();
    socket.send(Message::text(payload)).unwrap();
    let Message::Text(payload) = socket.read().unwrap() else {
        panic!("expected authentication result")
    };
    assert!(matches!(
        serde_json::from_str::<RemoteDeviceServerEnvelope>(payload.as_ref())
            .unwrap()
            .message,
        DeviceServerMessage::DeviceAuthenticated { .. }
    ));
    socket.close(None).unwrap();
    server.join().unwrap();
}

#[test]
fn remote_status_prefers_a_ready_public_url_and_keeps_lan_fallback() {
    let tunnel = super::super::remote_tunnel::TunnelSnapshot {
        state: super::super::remote_tunnel::TunnelState::Ready,
        public_url: Some("https://remote-test.lhr.life".to_string()),
        error: None,
    };

    let status = status_with_tunnel(true, 53_631, Some("pair-once".to_string()), Some(tunnel));

    assert_eq!(status.url, "https://remote-test.lhr.life");
    assert!(status.lan_url.starts_with("http://"));
    assert_eq!(status.public_url.as_deref(), Some(status.url.as_str()));
    assert_eq!(
        status.tunnel_state,
        super::super::remote_tunnel::TunnelState::Ready
    );
    assert_eq!(status.bootstrap_secret.as_deref(), Some("pair-once"));
}

#[test]
fn remote_status_uses_lan_while_the_tunnel_is_degraded() {
    let tunnel = super::super::remote_tunnel::TunnelSnapshot {
        state: super::super::remote_tunnel::TunnelState::Degraded,
        public_url: None,
        error: Some("provider disconnected".to_string()),
    };

    let status = status_with_tunnel(true, 53_631, None, Some(tunnel));

    assert_eq!(status.url, status.lan_url);
    assert_eq!(status.public_url, None);
    assert_eq!(
        status.tunnel_error.as_deref(),
        Some("provider disconnected")
    );
}

#[test]
fn running_remote_status_hides_the_setup_link_after_password_creation() {
    let auth = Arc::new(Mutex::new(RemoteAuth::from_material(
        "auto-start-secret",
        [11_u8; 32],
        now_unix_seconds().saturating_add(300),
        3_600,
    )));
    let mut server = RemoteServer {
        shutdown: Arc::new(AtomicBool::new(false)),
        handle: None,
        listen_addr: SocketAddr::from(([127, 0, 0, 1], 53_631)),
        tunnel: None,
        tunnel_start_error: Some("test tunnel unavailable".to_string()),
        auth: Arc::clone(&auth),
        bootstrap_secret: Some("auto-start-secret".to_string()),
        devices: Arc::new(Mutex::new(DeviceRegistry::new_for_test([1_u8; 32]))),
        relay: None,
        relay_identity: RemoteRelayIdentity {
            relay_id: "test-relay".to_string(),
            credential: "test-credential".to_string(),
        },
    };

    assert_eq!(
        server.status().bootstrap_secret.as_deref(),
        Some("auto-start-secret")
    );
    auth.lock()
        .unwrap()
        .setup_password(
            "auto-start-secret",
            "correct horse battery staple",
            now_unix_seconds(),
        )
        .unwrap();
    assert_eq!(server.status().bootstrap_secret, None);
}

#[test]
fn running_remote_status_rotates_an_expired_setup_link() {
    let auth = Arc::new(Mutex::new(RemoteAuth::from_material(
        "expired-secret",
        [12_u8; 32],
        now_unix_seconds().saturating_sub(1),
        3_600,
    )));
    let mut server = RemoteServer {
        shutdown: Arc::new(AtomicBool::new(false)),
        handle: None,
        listen_addr: SocketAddr::from(([127, 0, 0, 1], 53_631)),
        tunnel: None,
        tunnel_start_error: Some("test tunnel unavailable".to_string()),
        auth: Arc::clone(&auth),
        bootstrap_secret: Some("expired-secret".to_string()),
        devices: Arc::new(Mutex::new(DeviceRegistry::new_for_test([2_u8; 32]))),
        relay: None,
        relay_identity: RemoteRelayIdentity {
            relay_id: "test-relay".to_string(),
            credential: "test-credential".to_string(),
        },
    };

    let refreshed = server
        .status()
        .bootstrap_secret
        .expect("expired setup link should be refreshed");

    assert_ne!(refreshed, "expired-secret");
    assert!(auth
        .lock()
        .unwrap()
        .setup_password(&refreshed, "taotest123", now_unix_seconds())
        .is_ok());
}

#[test]
fn lan_fallback_prefers_a_private_interface_without_an_internet_route() {
    let candidates = [
        IpAddr::from([0, 0, 0, 0]),
        IpAddr::from([127, 0, 0, 1]),
        IpAddr::from([169, 254, 4, 2]),
        IpAddr::from([192, 168, 50, 12]),
        IpAddr::from([10, 0, 0, 8]),
    ];

    assert_eq!(
        select_lan_ip(candidates),
        Some(IpAddr::from([192, 168, 50, 12]))
    );
}

#[test]
fn remote_directory_response_lists_files_without_reading_contents() {
    let home = dirs::home_dir().expect("home directory");
    let root = tempfile::Builder::new()
        .prefix("cmdspace-remote-picker-")
        .tempdir_in(home)
        .expect("temporary remote picker directory");
    std::fs::create_dir(root.path().join("project-folder")).expect("create folder");
    std::fs::write(root.path().join("README.md"), "private contents").expect("create file");

    let response = remote_folders_response(&format!(
        "/api/remote/folders?path={}",
        root.path().display()
    ))
    .expect("directory response");
    let payload: serde_json::Value = serde_json::from_str(&response).expect("valid json");

    assert_eq!(payload["folders"][0]["name"], "project-folder");
    assert_eq!(payload["files"][0]["name"], "README.md");
    assert_eq!(
        payload["files"][0]["parent"],
        root.path().to_string_lossy().as_ref()
    );
    assert!(!response.contains("private contents"));
}

#[test]
fn remote_directory_listing_scans_each_directory_once() {
    let source = include_str!("runtime_http.rs");
    let listing = source
        .split_once("fn remote_folders_response")
        .unwrap()
        .1
        .split_once("fn stream_remote_events")
        .unwrap()
        .0;

    assert_eq!(listing.matches("fs::read_dir(&current_path)").count(), 1);
}

#[test]
fn legacy_terminal_http_routes_are_retired() {
    assert!(is_legacy_remote_terminal_path("/api/remote/sessions"));
    assert!(is_legacy_remote_terminal_path(
        "/api/remote/runtime/sessions"
    ));
    assert!(is_legacy_remote_terminal_path("/api/remote/session"));
    assert!(is_legacy_remote_terminal_path(
        "/api/remote/session/42/input"
    ));
    assert!(!is_legacy_remote_terminal_path("/api/remote/state"));
    assert!(!is_legacy_remote_terminal_path("/api/remote/folders"));
}

#[test]
fn bearer_token_is_read_from_the_authorization_header() {
    let request = b"GET /api/remote/state HTTP/1.1\r\nAuthorization: Bearer signed-token\r\n\r\n";

    assert_eq!(remote_bearer_token(request), Some("signed-token"));
}

#[test]
fn exited_runtime_output_is_not_advertised_as_live() {
    let mut output = RemoteOutput {
        next_seq: 1,
        chunks: VecDeque::new(),
        exited: false,
    };
    assert!(runtime_output_is_live(&output));

    output.exited = true;
    assert!(!runtime_output_is_live(&output));
}
