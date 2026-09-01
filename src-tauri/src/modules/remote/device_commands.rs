use super::super::remote_devices::DeviceRegistry;
use super::super::remote_protocol::{ClientMessage, DeviceServerMessage, Utf8StreamDecoder};
pub use super::device_attachment::{
    decode_device_bytes, drain_remote_device_websocket_output, release_native_attachment,
    send_remote_device_event, send_remote_device_websocket_message, RemoteDeviceAttachment,
};
use super::device_authorization::{require_create, require_view};
use super::device_filesystem::{
    create_remote_directory, send_remote_device_directory, send_remote_device_file,
    send_remote_device_folder_picker_directory,
};
pub use super::device_session_import::{
    import_browser_agent_session, list_browser_importable_sessions,
};
use super::device_session_import::{
    import_remote_agent_session, send_remote_device_importable_sessions,
};
use super::device_terminal_control::{
    attach_terminal, close_terminal, detach_terminal, input_terminal, resize_terminal,
};
#[allow(unused_imports)]
pub(crate) use super::device_views::{
    remote_protocol_sessions_for_device, send_remote_device_sessions, send_remote_device_workspaces,
};
use super::runtime::{create_mobile_workspace, resolve_mobile_session_cwd, spawn_remote_terminal};
use super::sessions::{RemoteRuntime, RemoteTerminal};
use std::{
    net::TcpStream,
    sync::{Arc, Mutex},
};
use tungstenite::WebSocket;

pub(super) fn handle_remote_device_command(
    socket: &mut WebSocket<TcpStream>,
    message: ClientMessage,
    runtime: &Arc<Mutex<RemoteRuntime>>,
    devices: &Arc<Mutex<DeviceRegistry>>,
    device_id: &str,
    attachment: &mut Option<RemoteDeviceAttachment>,
) -> Result<(), String> {
    match message {
        ClientMessage::Auth { .. } => {
            Err("native devices authenticate with a device signature".to_string())
        }
        ClientMessage::ListSessions => {
            require_view(devices, device_id, "device cannot view sessions")?;
            send_remote_device_sessions(socket, runtime, device_id)
        }
        ClientMessage::ListWorkspaces => send_remote_device_workspaces(socket, devices, device_id),
        ClientMessage::ListFolderPickerDirectory { path } => {
            require_view(devices, device_id, "device cannot browse desktop folders")?;
            send_remote_device_folder_picker_directory(socket, path.as_deref())
        }
        ClientMessage::ListDirectory { workspace_id, path } => {
            require_view(devices, device_id, "device cannot view directories")?;
            send_remote_device_directory(socket, device_id, &workspace_id, path.as_deref())
        }
        ClientMessage::ReadFile { workspace_id, path } => {
            require_view(devices, device_id, "device cannot view files")?;
            send_remote_device_file(socket, device_id, &workspace_id, &path)
        }
        ClientMessage::CreateDirectory {
            workspace_id,
            path,
            name,
        } => {
            require_create(devices, device_id, "device cannot create folders")?;
            create_remote_directory(device_id, &workspace_id, &path, &name)?;
            send_remote_device_directory(socket, device_id, &workspace_id, Some(&path))
        }
        ClientMessage::CreateSession { cwd, workspace_id } => {
            require_create(devices, device_id, "device cannot create terminals")?;
            let cwd =
                resolve_mobile_session_cwd(device_id, cwd.as_deref(), workspace_id.as_deref())?;
            let mut guard = runtime
                .lock()
                .map_err(|_| "remote runtime poisoned".to_string())?;
            let session = spawn_remote_terminal(cwd, workspace_id, Some(device_id.to_string()))?;
            let id = guard.next_id;
            guard.next_id = guard.next_id.saturating_add(1);
            guard.sessions.insert(id, session);
            drop(guard);
            send_remote_device_sessions(socket, runtime, device_id)
        }
        ClientMessage::CreateWorkspace {
            workspace_id,
            name,
            working_folder,
            terminal_count,
        } => {
            require_create(devices, device_id, "device cannot create workspaces")?;
            create_mobile_workspace(
                runtime,
                device_id,
                workspace_id,
                name,
                working_folder,
                terminal_count,
            )?;
            send_remote_device_workspaces(socket, devices, device_id)?;
            send_remote_device_sessions(socket, runtime, device_id)
        }
        ClientMessage::ListImportableSessions {
            workspace_id,
            workspace_only,
        } => {
            require_view(devices, device_id, "device cannot view importable sessions")?;
            let workspace_id = workspace_id
                .ok_or_else(|| "workspace is required for paired devices".to_string())?;
            send_remote_device_importable_sessions(socket, device_id, &workspace_id, workspace_only)
        }
        ClientMessage::ImportSession {
            workspace_id,
            provider,
            session_id,
        } => {
            require_create(devices, device_id, "device cannot import sessions")?;
            let workspace_id = workspace_id
                .ok_or_else(|| "workspace is required for paired devices".to_string())?;
            import_remote_agent_session(runtime, device_id, &workspace_id, &provider, &session_id)?;
            send_remote_device_sessions(socket, runtime, device_id)
        }
        ClientMessage::Attach { session_id, after } => attach_terminal(
            socket, runtime, devices, device_id, session_id, after, attachment,
        ),
        ClientMessage::Detach { session_id } => {
            detach_terminal(session_id, device_id, attachment);
            Ok(())
        }
        ClientMessage::Input { session_id, data } => {
            input_terminal(runtime, devices, device_id, session_id, &data)
        }
        ClientMessage::Resize {
            session_id,
            cols,
            rows,
        } => resize_terminal(runtime, devices, device_id, session_id, cols, rows),
        ClientMessage::Close { session_id } => {
            close_terminal(runtime, devices, device_id, session_id, attachment)
        }
        ClientMessage::Ping => {
            send_remote_device_websocket_message(socket, DeviceServerMessage::Pong)
        }
    }
}
pub(super) enum RemoteWebSocketAttachment {
    Runtime {
        id: u64,
        session: Arc<RemoteTerminal>,
        cursor: u64,
        decoder: Utf8StreamDecoder,
    },
}
