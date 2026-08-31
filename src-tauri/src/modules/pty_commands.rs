use std::hash::{Hash, Hasher};
use std::io::Write;
use std::sync::atomic::Ordering;

use portable_pty::PtySize;
use tauri::ipc::{Channel, Response};

use super::{session, session_import, shell_init};
use super::{PtySessionInfo, PtyState};
use crate::modules::workspace::{authorize_spawn_cwd, WorkspaceEnv, WorkspaceRegistry};

#[tauri::command]
pub fn pty_available_shells() -> Vec<String> {
    shell_init::available_shells()
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn pty_open(
    app: tauri::AppHandle,
    state: tauri::State<'_, PtyState>,
    registry: tauri::State<'_, WorkspaceRegistry>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    initial_command: Option<String>,
    shell: Option<String>,
    workspace: Option<WorkspaceEnv>,
    on_data: Channel<Response>,
    on_exit: Channel<i32>,
) -> Result<u32, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let open_t0 = std::time::Instant::now();
    authorize_spawn_cwd(&registry, cwd.as_deref(), &workspace).map_err(|e| {
        log::warn!("pty_open: cwd rejected: {e}");
        e
    })?;
    let metadata_cwd = cwd.clone();
    let id = state.next_id.fetch_add(1, Ordering::Relaxed);
    let session = tauri::async_runtime::spawn_blocking(move || {
        session::spawn(
            id,
            app,
            cols,
            rows,
            cwd,
            initial_command,
            shell,
            workspace,
            on_data,
            on_exit,
        )
        .map(|(s, _)| s)
    })
    .await
    .map_err(|e| {
        log::error!("pty_open join failed: {e}");
        e.to_string()
    })?
    .map_err(|e| {
        log::error!("pty_open failed: {e}");
        e
    })?;
    state.sessions.write().unwrap().insert(id, session);
    state.sizes.write().unwrap().insert(id, (cols, rows));
    state.metadata.write().unwrap().insert(
        id,
        PtySessionInfo {
            id,
            title: format!("Terminal {id}"),
            cwd: metadata_cwd,
            agent: None,
        },
    );
    log::info!(
        "pty opened id={id} cols={cols} rows={rows} in {}ms (spawn_blocking)",
        open_t0.elapsed().as_millis()
    );
    Ok(id)
}

#[tauri::command]
pub fn pty_write(state: tauri::State<PtyState>, id: u32, data: String) -> Result<(), String> {
    let session = state
        .sessions
        .read()
        .unwrap()
        .get(&id)
        .cloned()
        .ok_or_else(|| {
            log::warn!("pty_write: unknown id={id}");
            "no session".to_string()
        })?;
    let result = session
        .writer
        .lock()
        .unwrap()
        .write_all(data.as_bytes())
        .map_err(|e| {
            log::debug!("pty_write id={id} failed: {e}");
            e.to_string()
        });
    result
}

#[tauri::command]
pub fn pty_trace_input(source: String, data: String) {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    data.hash(&mut hasher);
    log::info!(
        "[IME-TRACE] source={source} bytes={} fingerprint={:016x}",
        data.len(),
        hasher.finish()
    );
}

#[tauri::command]
pub fn pty_resize(
    state: tauri::State<PtyState>,
    id: u32,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let session = state
        .sessions
        .read()
        .unwrap()
        .get(&id)
        .cloned()
        .ok_or_else(|| {
            log::warn!("pty_resize: unknown id={id}");
            "no session".to_string()
        })?;
    let result = session
        .master
        .lock()
        .unwrap()
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| {
            log::warn!("pty_resize id={id} failed: {e}");
            e.to_string()
        });
    if result.is_ok() {
        state.sizes.write().unwrap().insert(id, (cols, rows));
    }
    result
}

#[tauri::command]
pub fn pty_close(state: tauri::State<PtyState>, id: u32) -> Result<(), String> {
    let session = state.sessions.write().unwrap().remove(&id);
    state.metadata.write().unwrap().remove(&id);
    state.sizes.write().unwrap().remove(&id);
    if let Some(s) = session {
        #[cfg(unix)]
        s.terminate_process_group();
        if let Err(e) = s.killer.lock().unwrap().kill() {
            log::debug!("pty_close: kill id={id} returned {e}");
        }
        log::info!("pty closed id={id}");
        std::thread::Builder::new()
            .name(format!("cmdspace-pty-drop-{id}"))
            .spawn(move || {
                let t0 = std::time::Instant::now();
                session::drop_session(s);
                log::info!(
                    "pty session id={id} dropped in {}ms",
                    t0.elapsed().as_millis()
                );
            })
            .expect("spawn pty drop thread");
    } else {
        log::debug!("pty_close: unknown id={id}");
    }
    Ok(())
}

#[tauri::command]
pub fn pty_register_metadata(
    state: tauri::State<PtyState>,
    id: u32,
    title: Option<String>,
    cwd: Option<String>,
    agent: Option<String>,
) -> Result<(), String> {
    let mut metadata = state.metadata.write().unwrap();
    let entry = metadata
        .get_mut(&id)
        .ok_or_else(|| "no session".to_string())?;
    if let Some(title) = title.filter(|value| !value.trim().is_empty()) {
        entry.title = title;
    }
    if cwd.is_some() {
        entry.cwd = cwd;
    }
    if agent.is_some() {
        entry.agent = agent;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_list(state: tauri::State<PtyState>) -> Vec<PtySessionInfo> {
    let mut sessions: Vec<_> = state
        .metadata
        .read()
        .map(|metadata| metadata.values().cloned().collect())
        .unwrap_or_default();
    sessions.sort_by_key(|session| session.id);
    sessions
}

#[tauri::command]
pub async fn list_agent_sessions(
    limit: Option<usize>,
    workspace_cwd: Option<String>,
) -> Result<Vec<session_import::ImportableAgentSession>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        session_import::list_agent_sessions(limit, workspace_cwd)
    })
    .await
    .map_err(|error| format!("session scan task failed: {error}"))?
}
