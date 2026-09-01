use super::super::remote_auth::now_unix_seconds;
use super::super::remote_devices::DeviceRegistry;
use super::super::remote_protocol::{
    DeviceClientMessage, DeviceServerMessage, RemoteDeviceClientEnvelope,
};
use super::auth::device_challenge;
use super::device_commands::{
    decode_device_bytes, drain_remote_device_websocket_output, handle_remote_device_command,
    release_native_attachment, send_remote_device_websocket_message,
};
use super::http::request_header;
use super::sessions::RemoteRuntime;
use std::{
    io::Write,
    net::TcpStream,
    sync::{Arc, Mutex},
    time::Duration,
};
use tungstenite::{protocol::Role, Error as WebSocketError, Message, WebSocket};

/// Native devices use a deliberately separate endpoint and v3 envelope. The
/// browser's password-based v2 endpoint remains byte-for-byte compatible.
pub(super) fn handle_remote_device_websocket(
    stream: &mut TcpStream,
    request: &[u8],
    runtime: Arc<Mutex<RemoteRuntime>>,
    devices: Arc<Mutex<DeviceRegistry>>,
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

    let challenge = device_challenge();
    let _ = send_remote_device_websocket_message(
        &mut socket,
        DeviceServerMessage::PairingChallenge {
            challenge: challenge.clone(),
        },
    );
    let mut device_id = None::<String>;
    let mut attachment = None;

    loop {
        drain_remote_device_websocket_output(&mut socket, &mut attachment);
        match socket.read() {
            Ok(Message::Text(text)) => {
                let result = serde_json::from_str::<RemoteDeviceClientEnvelope>(text.as_ref())
                    .map_err(|error| error.to_string())
                    .and_then(|envelope| match envelope.message {
                        DeviceClientMessage::PairDevice {
                            grant_secret,
                            device_name: _,
                            public_key,
                            proof,
                        } => {
                            if device_id.is_some() {
                                return Err(
                                    "device is already paired for this connection".to_string()
                                );
                            }
                            let public_key = decode_device_bytes::<32>(&public_key, "public key")?;
                            let proof = decode_device_bytes::<64>(&proof, "pairing proof")?;
                            let paired = devices
                                .lock()
                                .map_err(|_| "remote device registry poisoned".to_string())?
                                .consume_grant_with_proof(
                                    &grant_secret,
                                    public_key,
                                    proof,
                                    now_unix_seconds(),
                                )
                                .map_err(|error| format!("pairing failed: {error:?}"))?;
                            devices
                                .lock()
                                .map_err(|_| "remote device registry poisoned".to_string())?
                                .save()
                                .map_err(|error| format!("save paired device failed: {error:?}"))?;
                            log::info!("paired native remote device {}", paired.id);
                            Ok(())
                        }
                        DeviceClientMessage::AuthenticateDevice {
                            device_id: requested,
                            proof,
                        } => {
                            let proof = decode_device_bytes::<64>(&proof, "authentication proof")?;
                            let valid = devices
                                .lock()
                                .map_err(|_| "remote device registry poisoned".to_string())?
                                .verify_device_proof(&requested, challenge.as_bytes(), proof);
                            if !valid {
                                return Err("device authentication failed".to_string());
                            }
                            device_id = Some(requested.clone());
                            send_remote_device_websocket_message(
                                &mut socket,
                                DeviceServerMessage::DeviceAuthenticated {
                                    device_id: requested,
                                },
                            )
                        }
                        DeviceClientMessage::Command { command } => {
                            let device_id = device_id.as_deref().ok_or_else(|| {
                                "authenticate the device before sending commands".to_string()
                            })?;
                            handle_remote_device_command(
                                &mut socket,
                                command,
                                &runtime,
                                &devices,
                                device_id,
                                &mut attachment,
                            )
                        }
                        DeviceClientMessage::Ping => send_remote_device_websocket_message(
                            &mut socket,
                            DeviceServerMessage::Pong,
                        ),
                    });
                if let Err(error) = result {
                    log::warn!("remote device WebSocket request failed: {error}");
                    let code = if error.contains("controlled by another paired device") {
                        "session_occupied"
                    } else if error.contains("cannot ") || error.contains("attach this terminal") {
                        "capability_denied"
                    } else if error.contains("authentication") || error.contains("pairing") {
                        "authentication_failed"
                    } else {
                        "invalid_message"
                    };
                    let _ = send_remote_device_websocket_message(
                        &mut socket,
                        DeviceServerMessage::Error {
                            code: code.to_string(),
                            message: error,
                            retryable: false,
                        },
                    );
                }
            }
            Ok(Message::Ping(payload)) => {
                if socket.send(Message::Pong(payload)).is_err() {
                    return;
                }
            }
            Ok(Message::Pong(_) | Message::Frame(_)) => {}
            Ok(Message::Binary(_)) => {
                let _ = send_remote_device_websocket_message(
                    &mut socket,
                    DeviceServerMessage::Error {
                        code: "binary_not_supported".to_string(),
                        message: "remote protocol messages must be JSON text".to_string(),
                        retryable: false,
                    },
                );
            }
            Ok(Message::Close(frame)) => {
                release_native_attachment(&mut attachment, device_id.as_deref());
                let _ = socket.close(frame);
                return;
            }
            Err(WebSocketError::Io(error))
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) => {}
            Err(_) => {
                release_native_attachment(&mut attachment, device_id.as_deref());
                return;
            }
        }
    }
}
