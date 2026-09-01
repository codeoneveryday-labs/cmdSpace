use super::super::db;
use super::super::remote_auth::RemoteAuth;
use super::super::remote_protocol::{
    ClientMessage, RemoteClientEnvelope, RemoteProtocolSession, RemoteProtocolWorkspace,
    RemoteServerEnvelope, ServerMessage, Utf8StreamDecoder,
};
use super::auth::authenticate_remote_websocket;
use super::device_commands::{
    import_browser_agent_session, list_browser_importable_sessions, RemoteWebSocketAttachment,
};
use super::http::request_header;
use super::providers::send_remote_providers;
use super::runtime::{
    close_remote_session, create_remote_workspace, resolve_remote_session_cwd,
    session_from_runtime, spawn_remote_terminal,
};
use super::sessions::{RemoteOutput, RemoteRuntime};
use std::{
    io::Write,
    net::{IpAddr, TcpStream},
    sync::{Arc, Mutex},
    time::Duration,
};
use tungstenite::{protocol::Role, Error as WebSocketError, Message, WebSocket};

pub(super) fn handle_remote_websocket(
    stream: &mut TcpStream,
    request: &[u8],
    runtime: Arc<Mutex<RemoteRuntime>>,
    auth: Arc<Mutex<RemoteAuth>>,
    client_ip: IpAddr,
) {
    let Some(key) = request_header(request, "Sec-WebSocket-Key") else {
        return;
    };
    let accept_key = tungstenite::handshake::derive_accept_key(key.as_bytes());
    let handshake = format!(
        "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {accept_key}\r\n\r\n"
    );
    if stream.write_all(handshake.as_bytes()).is_err() || stream.flush().is_err() {
        return;
    }

    let Ok(socket_stream) = stream.try_clone() else {
        return;
    };
    let mut socket = WebSocket::from_raw_socket(socket_stream, Role::Server, None);
    let _ = socket
        .get_mut()
        .set_read_timeout(Some(Duration::from_millis(100)));
    let runtime_id = runtime.lock().map(|runtime| runtime.id).unwrap_or_default();
    let _ = send_remote_websocket_message(
        &mut socket,
        ServerMessage::Hello {
            authenticated: false,
            runtime_id,
        },
    );
    let mut attachment = None;
    let mut authenticated_generation = None;

    loop {
        if authenticated_generation.is_some_and(|generation| {
            auth.lock()
                .map(|auth| auth.session_generation() != generation)
                .unwrap_or(true)
        }) {
            let _ = socket.close(None);
            return;
        }
        drain_remote_websocket_output(&mut socket, &mut attachment);
        match socket.read() {
            Ok(Message::Text(text)) => {
                let result = serde_json::from_str::<RemoteClientEnvelope>(text.as_ref())
                    .map_err(|error| error.to_string())
                    .and_then(|envelope| {
                        if authenticated_generation.is_none() {
                            let ClientMessage::Auth { token } = envelope.message else {
                                return Err(
                                    "the first WebSocket message must authenticate".to_string()
                                );
                            };
                            authenticated_generation =
                                Some(authenticate_remote_websocket(&auth, client_ip, &token)?);
                            send_remote_websocket_message(
                                &mut socket,
                                ServerMessage::Authenticated,
                            )?;
                            return send_remote_providers(&mut socket);
                        }
                        handle_remote_websocket_message(
                            &mut socket,
                            envelope.message,
                            &runtime,
                            &mut attachment,
                        )
                    });
                if let Err(error) = result {
                    log::warn!("remote WebSocket request failed: {error}");
                    let _ = send_remote_websocket_message(
                        &mut socket,
                        ServerMessage::Error {
                            code: "invalid_message".to_string(),
                            message: error,
                            retryable: false,
                        },
                    );
                }
            }
            Ok(Message::Binary(_)) => {
                let _ = send_remote_websocket_message(
                    &mut socket,
                    ServerMessage::Error {
                        code: "binary_not_supported".to_string(),
                        message: "remote protocol messages must be JSON text".to_string(),
                        retryable: false,
                    },
                );
            }
            Ok(Message::Ping(payload)) => {
                if socket.send(Message::Pong(payload)).is_err() {
                    return;
                }
            }
            Ok(Message::Pong(_)) => {}
            Ok(Message::Frame(_)) => {}
            Ok(Message::Close(frame)) => {
                let _ = socket.close(frame);
                return;
            }
            Err(WebSocketError::Io(error))
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) => {}
            Err(_) => return,
        }
    }
}
pub(super) fn handle_remote_websocket_message(
    socket: &mut WebSocket<TcpStream>,
    message: ClientMessage,
    runtime: &Arc<Mutex<RemoteRuntime>>,
    attachment: &mut Option<RemoteWebSocketAttachment>,
) -> Result<(), String> {
    match message {
        ClientMessage::Auth { .. } => Err("WebSocket session is already authenticated".to_string()),
        ClientMessage::ListSessions => send_remote_sessions(socket, runtime),
        ClientMessage::ListWorkspaces => send_remote_workspaces(socket),
        ClientMessage::ListFolderPickerDirectory { .. }
        | ClientMessage::ListDirectory { .. }
        | ClientMessage::ReadFile { .. }
        | ClientMessage::CreateDirectory { .. } => {
            Err("this action is available to paired native devices only".to_string())
        }
        ClientMessage::ListImportableSessions {
            workspace_id,
            workspace_only,
        } => {
            let sessions = list_browser_importable_sessions(workspace_id, workspace_only)?;
            send_remote_websocket_message(socket, ServerMessage::ImportableSessions { sessions })
        }
        ClientMessage::ImportSession {
            workspace_id,
            provider,
            session_id,
        } => {
            import_browser_agent_session(runtime, workspace_id, &provider, &session_id)?;
            send_remote_sessions(socket, runtime)
        }
        ClientMessage::CreateSession { cwd, workspace_id } => {
            let cwd = resolve_remote_session_cwd(cwd.as_deref(), workspace_id.as_deref())?;
            let mut guard = runtime
                .lock()
                .map_err(|_| "remote runtime poisoned".to_string())?;
            let existing = guard.sessions.iter().find_map(|(id, session)| {
                let live = session
                    .output
                    .lock()
                    .map(|output| runtime_output_is_live(&output))
                    .unwrap_or(false);
                (session.cwd == cwd && session.workspace_id == workspace_id && live).then_some(*id)
            });
            if existing.is_none() {
                let session = spawn_remote_terminal(cwd.clone(), workspace_id, None)?;
                let id = guard.next_id;
                guard.next_id = guard.next_id.saturating_add(1);
                guard.sessions.insert(id, session);
            }
            drop(guard);
            send_remote_sessions(socket, runtime)
        }
        ClientMessage::CreateWorkspace {
            workspace_id,
            name,
            working_folder,
            terminal_count,
        } => {
            create_remote_workspace(runtime, workspace_id, name, working_folder, terminal_count)?;
            send_remote_workspaces(socket)?;
            send_remote_sessions(socket, runtime)
        }
        ClientMessage::Attach { session_id, after } => {
            *attachment = None;
            let session = session_from_runtime(runtime, session_id)?;
            let chunks = session
                .output
                .lock()
                .map_err(|_| "remote output poisoned".to_string())?
                .chunks
                .iter()
                .filter(|(sequence, _)| *sequence > after)
                .cloned()
                .collect::<Vec<_>>();
            let mut cursor = after;
            let mut decoder = Utf8StreamDecoder::default();
            for (sequence, bytes) in chunks {
                cursor = sequence;
                let data = decoder.push(&bytes);
                if !data.is_empty() {
                    send_remote_websocket_message(
                        socket,
                        ServerMessage::Snapshot {
                            session_id,
                            sequence,
                            data,
                        },
                    )?;
                }
            }
            *attachment = Some(RemoteWebSocketAttachment::Runtime {
                id: session_id,
                session,
                cursor,
                decoder,
            });
            Ok(())
        }
        ClientMessage::Detach { session_id } => {
            if attachment
                .as_ref()
                .is_some_and(|current| remote_websocket_attachment_id(current) == session_id)
            {
                *attachment = None;
            }
            Ok(())
        }
        ClientMessage::Input { session_id, data } => {
            let session = session_from_runtime(runtime, session_id)?;
            let mut writer = session
                .writer
                .lock()
                .map_err(|_| "writer poisoned".to_string())?;
            writer
                .write_all(data.as_bytes())
                .map_err(|error| error.to_string())?;
            writer.flush().map_err(|error| error.to_string())
        }
        ClientMessage::Resize {
            session_id,
            cols,
            rows,
        } => {
            if cols == 0 || rows == 0 {
                return Err("terminal size must be positive".to_string());
            }
            session_from_runtime(runtime, session_id)?
                .master
                .lock()
                .map_err(|_| "master poisoned".to_string())?
                .resize(portable_pty::PtySize {
                    cols: cols.min(400),
                    rows: rows.min(200),
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|error| error.to_string())
        }
        ClientMessage::Close { session_id } => {
            close_remote_session(runtime, session_id);
            if attachment
                .as_ref()
                .is_some_and(|current| remote_websocket_attachment_id(current) == session_id)
            {
                *attachment = None;
            }
            Ok(())
        }
        ClientMessage::Ping => {
            send_remote_websocket_message(socket, ServerMessage::Pong)?;
            send_remote_providers(socket)
        }
    }
}

pub(super) fn send_remote_workspaces(socket: &mut WebSocket<TcpStream>) -> Result<(), String> {
    let workspaces = db::list_workspaces_inner(&db::init_db()?)?
        .into_iter()
        .filter_map(|workspace| {
            (workspace.workspace_mode.as_deref() != Some("canvas"))
                .then_some((workspace.id, workspace.name, workspace.working_folder))
                .and_then(|(id, name, working_folder)| {
                    working_folder.map(|working_folder| RemoteProtocolWorkspace {
                        id,
                        name,
                        working_folder,
                    })
                })
        })
        .collect();
    send_remote_websocket_message(socket, ServerMessage::Workspaces { workspaces })
}

pub(super) fn send_remote_sessions(
    socket: &mut WebSocket<TcpStream>,
    runtime: &Arc<Mutex<RemoteRuntime>>,
) -> Result<(), String> {
    let mut sessions = Vec::new();
    let mut runtime_guard = runtime
        .lock()
        .map_err(|_| "remote runtime poisoned".to_string())?;
    runtime_guard.sessions.retain(|_, session| {
        session
            .output
            .lock()
            .map(|output| runtime_output_is_live(&output))
            .unwrap_or(false)
    });
    let runtime_sessions =
        runtime_guard
            .sessions
            .iter()
            .map(|(id, session)| RemoteProtocolSession {
                id: *id,
                title: "Remote terminal".to_string(),
                cwd: session.cwd.clone(),
                workspace_id: session.workspace_id.clone(),
                agent: None,
                attached: false,
            });
    sessions.extend(runtime_sessions);
    send_remote_websocket_message(socket, ServerMessage::Sessions { sessions })
}

pub(super) fn drain_remote_websocket_output(
    socket: &mut WebSocket<TcpStream>,
    attachment: &mut Option<RemoteWebSocketAttachment>,
) {
    let Some(current) = attachment else {
        return;
    };
    match current {
        RemoteWebSocketAttachment::Runtime {
            id,
            session,
            cursor,
            decoder,
        } => {
            let (chunks, exited) = session
                .output
                .lock()
                .map(|output| {
                    (
                        output
                            .chunks
                            .iter()
                            .filter(|(sequence, _)| *sequence > *cursor)
                            .cloned()
                            .collect::<Vec<_>>(),
                        output.exited,
                    )
                })
                .unwrap_or_default();
            for (sequence, bytes) in chunks {
                let data = decoder.push(&bytes);
                if !data.is_empty()
                    && send_remote_websocket_message(
                        socket,
                        ServerMessage::Output {
                            session_id: *id,
                            sequence,
                            data,
                        },
                    )
                    .is_err()
                {
                    return;
                }
                *cursor = sequence;
            }
            if exited {
                let _ = send_remote_websocket_message(
                    socket,
                    ServerMessage::Exit {
                        session_id: *id,
                        code: None,
                    },
                );
                *attachment = None;
            }
        }
    }
}

pub(super) fn remote_websocket_attachment_id(attachment: &RemoteWebSocketAttachment) -> u64 {
    match attachment {
        RemoteWebSocketAttachment::Runtime { id, .. } => *id,
    }
}

pub(super) fn runtime_output_is_live(output: &RemoteOutput) -> bool {
    !output.exited
}

pub(super) fn send_remote_websocket_message(
    socket: &mut WebSocket<TcpStream>,
    message: ServerMessage,
) -> Result<(), String> {
    let envelope = RemoteServerEnvelope::new(message);
    let payload = serde_json::to_string(&envelope).map_err(|error| error.to_string())?;
    socket
        .send(Message::text(payload))
        .map_err(|error| error.to_string())
}

pub(super) use super::device_websocket::handle_remote_device_websocket;
