use super::super::pty::PtyState;
use super::http::{desktop_session_id, request_body};
pub(super) use super::runtime_creation::{
    create_mobile_workspace, create_remote_session, create_remote_workspace,
};
#[allow(unused_imports)]
pub(super) use super::runtime_cwd::strip_verbatim_prefix;
pub(super) use super::runtime_cwd::{
    authorize_remote_cwd, resolve_mobile_session_cwd, resolve_mobile_workspace_cwd,
    resolve_remote_session_cwd,
};
pub(super) use super::runtime_http::{
    pty_snapshot_response, remote_folders_response, stream_pty_events, stream_remote_events,
};
#[allow(unused_imports)]
pub(super) use super::runtime_pty::{build_remote_shell_command, spawn_remote_terminal};
use super::sessions::{RemoteRuntime, RemoteTerminal};
use std::{
    io::Write,
    sync::{Arc, Mutex},
};

pub(super) fn session_from_runtime(
    runtime: &Arc<Mutex<RemoteRuntime>>,
    id: u64,
) -> Result<Arc<RemoteTerminal>, String> {
    runtime
        .lock()
        .map_err(|_| "remote runtime poisoned".to_string())?
        .sessions
        .get(&id)
        .cloned()
        .ok_or_else(|| "session not found".to_string())
}

pub(super) fn session_from_owned_mobile_runtime(
    runtime: &Arc<Mutex<RemoteRuntime>>,
    id: u64,
    device_id: &str,
) -> Result<Arc<RemoteTerminal>, String> {
    let session = session_from_runtime(runtime, id)?;
    if session.owner_device_id.as_deref() != Some(device_id) {
        return Err("terminal does not belong to this paired device".to_string());
    }
    Ok(session)
}

pub(super) fn remote_session_input(
    request: &[u8],
    runtime: &Arc<Mutex<RemoteRuntime>>,
    pty_state: &PtyState,
    id: u64,
) -> Result<(), String> {
    #[derive(serde::Deserialize)]
    struct Input {
        data: String,
    }
    let input: Input = serde_json::from_str(request_body(request)).map_err(|e| e.to_string())?;
    if let Ok(session) = session_from_runtime(runtime, id) {
        let result = session
            .writer
            .lock()
            .map_err(|_| "writer poisoned".to_string())?
            .write_all(input.data.as_bytes())
            .map_err(|e| e.to_string());
        return result;
    }
    pty_state.write_remote(desktop_session_id(id)?, &input.data)
}

pub(super) fn remote_session_resize(
    request: &[u8],
    runtime: &Arc<Mutex<RemoteRuntime>>,
    pty_state: &PtyState,
    id: u64,
) -> Result<(), String> {
    #[derive(serde::Deserialize)]
    struct Input {
        cols: u16,
        rows: u16,
    }
    let input: Input = serde_json::from_str(request_body(request)).map_err(|e| e.to_string())?;
    if input.cols == 0 || input.rows == 0 {
        return Err("terminal size must be positive".to_string());
    }
    if let Ok(session) = session_from_runtime(runtime, id) {
        return session
            .master
            .lock()
            .map_err(|_| "master poisoned".to_string())?
            .resize(portable_pty::PtySize {
                cols: input.cols.min(400),
                rows: input.rows.min(200),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string());
    }
    // A desktop PTY is shared with the native terminal. Letting a phone
    // resize it would change the desktop's wrapping width and make the local
    // pane look empty on the right. The desktop owns dimensions for attached
    // sessions; remote-created sessions still use the requested size above.
    pty_state.restore_desktop_size(desktop_session_id(id)?)
}

pub(super) fn close_remote_session(runtime: &Arc<Mutex<RemoteRuntime>>, id: u64) {
    if let Ok(mut guard) = runtime.lock() {
        if let Some(session) = guard.sessions.remove(&id) {
            let _ = session.killer.lock().map(|mut killer| killer.kill());
        }
    }
}
