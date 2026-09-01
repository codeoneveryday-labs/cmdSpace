use super::super::db;
use super::super::remote_devices::DeviceRegistry;
use super::super::remote_protocol::{
    RemoteProtocolSession, RemoteProtocolWorkspace, ServerMessage,
};
use super::device_attachment::send_remote_device_event;
use super::device_authorization::require_view;
use super::sessions::RemoteRuntime;
use std::{
    net::TcpStream,
    sync::{Arc, Mutex},
};
use tungstenite::WebSocket;

pub(crate) fn send_remote_device_sessions(
    socket: &mut WebSocket<TcpStream>,
    runtime: &Arc<Mutex<RemoteRuntime>>,
    device_id: &str,
) -> Result<(), String> {
    let sessions = remote_protocol_sessions_for_device(runtime, device_id)?;
    send_remote_device_event(socket, ServerMessage::Sessions { sessions })
}

pub(crate) fn remote_protocol_sessions_for_device(
    runtime: &Arc<Mutex<RemoteRuntime>>,
    device_id: &str,
) -> Result<Vec<RemoteProtocolSession>, String> {
    Ok(runtime
        .lock()
        .map_err(|_| "remote runtime poisoned".to_string())?
        .sessions
        .iter()
        .filter(|(_, session)| session.owner_device_id.as_deref() == Some(device_id))
        .map(|(id, session)| RemoteProtocolSession {
            id: *id,
            title: "Mobile terminal".to_string(),
            cwd: session.cwd.clone(),
            workspace_id: session.workspace_id.clone(),
            agent: None,
            attached: false,
        })
        .collect())
}

pub(crate) fn send_remote_device_workspaces(
    socket: &mut WebSocket<TcpStream>,
    devices: &Arc<Mutex<DeviceRegistry>>,
    device_id: &str,
) -> Result<(), String> {
    require_view(devices, device_id, "device cannot view workspaces")?;
    let workspaces = db::list_mobile_workspaces_inner(&db::init_db()?, device_id)?
        .into_iter()
        .map(|workspace| RemoteProtocolWorkspace {
            id: workspace.id,
            name: workspace.name,
            working_folder: workspace.working_folder,
        })
        .collect();
    send_remote_device_event(socket, ServerMessage::Workspaces { workspaces })
}
