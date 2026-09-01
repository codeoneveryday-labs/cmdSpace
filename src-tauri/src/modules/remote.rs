use super::db;
use super::remote_tunnel::TunnelState;
mod auth;
mod device_attachment;
mod device_authorization;
mod device_commands;
mod device_filesystem;
mod device_session_import;
mod device_terminal_control;
mod device_views;
mod device_websocket;
mod http;
mod providers;
#[path = "remote_commands.rs"]
mod remote_commands;
mod runtime;
mod runtime_creation;
mod runtime_cwd;
mod runtime_http;
mod runtime_pty;
mod server;
mod sessions;
mod state;
#[cfg(test)]
mod tests;
mod websocket;
pub use remote_commands::{
    __cmd__remote_access_reset_password, __cmd__remote_access_start, __cmd__remote_access_status,
    __cmd__remote_access_stop, __cmd__remote_device_list, __cmd__remote_device_pairing_start,
    __cmd__remote_device_revoke, remote_access_reset_password, remote_access_start,
    remote_access_status, remote_access_stop, remote_device_list, remote_device_pairing_start,
    remote_device_revoke,
};
use serde::Serialize;
pub use state::RemoteAccessState;

#[derive(Debug)]
pub(crate) struct RemoteResponse {
    pub(crate) status: &'static str,
    pub(crate) content_type: &'static str,
    pub(crate) body: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RemoteUiState {
    pub(crate) workspaces: Vec<db::WorkspaceRow>,
    pub(crate) recent_workspaces: Vec<db::RecentWorkspaceRow>,
    pub(crate) hostname: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteAccessStatus {
    enabled: bool,
    url: String,
    lan_url: String,
    public_url: Option<String>,
    port: u16,
    tunnel_state: TunnelState,
    tunnel_error: Option<String>,
    target_port: Option<u16>,
    target_reachable: bool,
    auto_target: bool,
    ignored_cmdspace_dev_port: Option<u16>,
    bootstrap_secret: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDevicePairingStatus {
    pub secret: String,
    pub expires_at: u64,
    pub url: String,
    pub relay: String,
    pub relay_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemotePairedDeviceStatus {
    pub id: String,
    pub display_name: String,
    pub revoked: bool,
}
