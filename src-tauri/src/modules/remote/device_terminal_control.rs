use super::super::remote_devices::DeviceRegistry;
use super::super::remote_protocol::{ServerMessage, Utf8StreamDecoder};
use super::device_attachment::{
    release_native_attachment, remote_device_attachment_id, send_remote_device_event,
    RemoteDeviceAttachment,
};
use super::device_authorization::session_allowed;
use super::runtime::{close_remote_session, session_from_owned_mobile_runtime};
use super::sessions::RemoteRuntime;
use std::{
    io::Write,
    net::TcpStream,
    sync::{Arc, Mutex},
};
use tungstenite::WebSocket;

pub(super) fn attach_terminal(
    socket: &mut WebSocket<TcpStream>,
    runtime: &Arc<Mutex<RemoteRuntime>>,
    devices: &Arc<Mutex<DeviceRegistry>>,
    device_id: &str,
    session_id: u64,
    after: u64,
    attachment: &mut Option<RemoteDeviceAttachment>,
) -> Result<(), String> {
    if !session_allowed(devices, device_id, session_id, DeviceRegistry::can_view)? {
        return Err("device cannot view this terminal".to_string());
    }
    release_native_attachment(attachment, Some(device_id));
    let session = session_from_owned_mobile_runtime(runtime, session_id, device_id)?;
    if session_allowed(devices, device_id, session_id, DeviceRegistry::can_input)? {
        let mut controller = session
            .native_controller
            .lock()
            .map_err(|_| "terminal controller poisoned".to_string())?;
        if controller
            .as_deref()
            .is_some_and(|current| current != device_id)
        {
            return Err("terminal is controlled by another paired device".to_string());
        }
        *controller = Some(device_id.to_string());
    }
    let chunks = session
        .output
        .lock()
        .map_err(|_| "remote output poisoned".to_string())?
        .chunks
        .iter()
        .filter(|(sequence, _)| *sequence > after)
        .cloned()
        .collect::<Vec<_>>();
    *attachment = Some(RemoteDeviceAttachment::Runtime {
        id: session_id,
        session,
        cursor: after,
        decoder: Utf8StreamDecoder::default(),
    });
    send_remote_device_event(socket, ServerMessage::Attached { session_id })?;
    let RemoteDeviceAttachment::Runtime {
        cursor, decoder, ..
    } = attachment
        .as_mut()
        .expect("native attachment was just assigned");
    for (sequence, bytes) in chunks {
        *cursor = sequence;
        let data = decoder.push(&bytes);
        if !data.is_empty() {
            send_remote_device_event(
                socket,
                ServerMessage::Snapshot {
                    session_id,
                    sequence,
                    data,
                },
            )?;
        }
    }
    Ok(())
}

pub(super) fn detach_terminal(
    session_id: u64,
    device_id: &str,
    attachment: &mut Option<RemoteDeviceAttachment>,
) {
    if attachment
        .as_ref()
        .is_some_and(|current| remote_device_attachment_id(current) == session_id)
    {
        release_native_attachment(attachment, Some(device_id));
    }
}

pub(super) fn input_terminal(
    runtime: &Arc<Mutex<RemoteRuntime>>,
    devices: &Arc<Mutex<DeviceRegistry>>,
    device_id: &str,
    session_id: u64,
    data: &str,
) -> Result<(), String> {
    if !session_allowed(devices, device_id, session_id, DeviceRegistry::can_input)? {
        return Err("device cannot input to this terminal".to_string());
    }
    let session = session_from_owned_mobile_runtime(runtime, session_id, device_id)?;
    if session
        .native_controller
        .lock()
        .map_err(|_| "terminal controller poisoned".to_string())?
        .as_deref()
        != Some(device_id)
    {
        return Err("attach this terminal before sending input".to_string());
    }
    let mut writer = session
        .writer
        .lock()
        .map_err(|_| "writer poisoned".to_string())?;
    writer
        .write_all(data.as_bytes())
        .map_err(|error| error.to_string())?;
    writer.flush().map_err(|error| error.to_string())
}

pub(super) fn resize_terminal(
    runtime: &Arc<Mutex<RemoteRuntime>>,
    devices: &Arc<Mutex<DeviceRegistry>>,
    device_id: &str,
    session_id: u64,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    if cols == 0 || rows == 0 {
        return Err("terminal size must be positive".to_string());
    }
    if !session_allowed(devices, device_id, session_id, DeviceRegistry::can_input)? {
        return Err("device cannot resize this terminal".to_string());
    }
    let session = session_from_owned_mobile_runtime(runtime, session_id, device_id)?;
    if session
        .native_controller
        .lock()
        .map_err(|_| "terminal controller poisoned".to_string())?
        .as_deref()
        != Some(device_id)
    {
        return Err("attach this terminal before resizing".to_string());
    }
    let result = session
        .master
        .lock()
        .map_err(|_| "master poisoned".to_string())?
        .resize(portable_pty::PtySize {
            cols: cols.min(400),
            rows: rows.min(200),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string());
    result
}

pub(super) fn close_terminal(
    runtime: &Arc<Mutex<RemoteRuntime>>,
    devices: &Arc<Mutex<DeviceRegistry>>,
    device_id: &str,
    session_id: u64,
    attachment: &mut Option<RemoteDeviceAttachment>,
) -> Result<(), String> {
    if !session_allowed(
        devices,
        device_id,
        session_id,
        DeviceRegistry::can_close_terminal,
    )? {
        return Err("device cannot close this terminal".to_string());
    }
    session_from_owned_mobile_runtime(runtime, session_id, device_id)?;
    close_remote_session(runtime, session_id);
    release_native_attachment(attachment, Some(device_id));
    Ok(())
}
