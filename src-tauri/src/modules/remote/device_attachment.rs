use super::super::remote_protocol::{
    DeviceServerMessage, RemoteDeviceServerEnvelope, ServerMessage, Utf8StreamDecoder,
};
use super::sessions::RemoteTerminal;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use std::{net::TcpStream, sync::Arc};
use tungstenite::{Message, WebSocket};

pub enum RemoteDeviceAttachment {
    Runtime {
        id: u64,
        session: Arc<RemoteTerminal>,
        cursor: u64,
        decoder: Utf8StreamDecoder,
    },
}

pub fn decode_device_bytes<const N: usize>(value: &str, label: &str) -> Result<[u8; N], String> {
    let bytes = URL_SAFE_NO_PAD
        .decode(value)
        .map_err(|_| format!("{label} is not valid base64url"))?;
    bytes
        .try_into()
        .map_err(|_| format!("{label} has an invalid length"))
}

pub fn send_remote_device_event(
    socket: &mut WebSocket<TcpStream>,
    event: ServerMessage,
) -> Result<(), String> {
    send_remote_device_websocket_message(socket, DeviceServerMessage::Event { event })
}

pub fn send_remote_device_websocket_message(
    socket: &mut WebSocket<TcpStream>,
    message: DeviceServerMessage,
) -> Result<(), String> {
    let payload = serde_json::to_string(&RemoteDeviceServerEnvelope::new(message))
        .map_err(|error| error.to_string())?;
    socket
        .send(Message::text(payload))
        .map_err(|error| error.to_string())
}

pub fn drain_remote_device_websocket_output(
    socket: &mut WebSocket<TcpStream>,
    attachment: &mut Option<RemoteDeviceAttachment>,
) {
    let Some(RemoteDeviceAttachment::Runtime {
        id,
        session,
        cursor,
        decoder,
    }) = attachment
    else {
        return;
    };
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
            && send_remote_device_event(
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
        let _ = send_remote_device_event(
            socket,
            ServerMessage::Exit {
                session_id: *id,
                code: None,
            },
        );
        *attachment = None;
    }
}

pub fn remote_device_attachment_id(attachment: &RemoteDeviceAttachment) -> u64 {
    match attachment {
        RemoteDeviceAttachment::Runtime { id, .. } => *id,
    }
}

pub fn release_native_attachment(
    attachment: &mut Option<RemoteDeviceAttachment>,
    device_id: Option<&str>,
) {
    if let Some(RemoteDeviceAttachment::Runtime { session, .. }) = attachment.take() {
        if let (Some(device_id), Ok(mut controller)) = (device_id, session.native_controller.lock())
        {
            if controller.as_deref() == Some(device_id) {
                *controller = None;
            }
        }
    }
}
