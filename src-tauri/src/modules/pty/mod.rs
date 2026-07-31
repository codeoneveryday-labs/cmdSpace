mod da_filter;
#[cfg(windows)]
mod job;
mod session;
pub(crate) mod shell_init;

use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, RwLock};
use std::thread;

use portable_pty::PtySize;
use serde::Serialize;
use tauri::ipc::{Channel, Response};

use crate::modules::workspace::{authorize_spawn_cwd, WorkspaceEnv, WorkspaceRegistry};
use session::Session;

type PtyOutputSubscription = session::OutputSubscription;

#[derive(Clone)]
pub struct PtyState {
    sessions: Arc<RwLock<HashMap<u32, Arc<Session>>>>,
    metadata: Arc<RwLock<HashMap<u32, PtySessionInfo>>>,
    sizes: Arc<RwLock<HashMap<u32, (u16, u16)>>>,
    // Starts at 1 so freshly-handed-out ids are never 0, which the frontend
    // sometimes treats as "unset". Increments monotonically; never reused.
    next_id: Arc<AtomicU32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySessionInfo {
    pub id: u32,
    pub title: String,
    pub cwd: Option<String>,
    pub agent: Option<String>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            metadata: Arc::new(RwLock::new(HashMap::new())),
            sizes: Arc::new(RwLock::new(HashMap::new())),
            next_id: Arc::new(AtomicU32::new(1)),
        }
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn pty_open(
    state: tauri::State<'_, PtyState>,
    registry: tauri::State<'_, WorkspaceRegistry>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    initial_command: Option<String>,
    workspace: Option<WorkspaceEnv>,
    on_data: Channel<Response>,
    on_exit: Channel<i32>,
) -> Result<u32, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    authorize_spawn_cwd(&registry, cwd.as_deref(), &workspace).map_err(|e| {
        log::warn!("pty_open: cwd rejected: {e}");
        e
    })?;
    let metadata_cwd = cwd.clone();
    let session = tauri::async_runtime::spawn_blocking(move || {
        session::spawn(
            cols,
            rows,
            cwd,
            initial_command,
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
    let id = state.next_id.fetch_add(1, Ordering::Relaxed);
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
    log::info!("pty opened id={id} cols={cols} rows={rows}");
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
    // Bind to a local so the MutexGuard temporary drops before `session` —
    // see rustc note on tail-expression temporary drop order.
    let result = session
        .writer
        .lock()
        .unwrap()
        .write_all(data.as_bytes())
        .map_err(|e| {
            // EPIPE is expected if the child already exited.
            log::debug!("pty_write id={id} failed: {e}");
            e.to_string()
        });
    result
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
        if let Err(e) = s.killer.lock().unwrap().kill() {
            // Non-fatal: the child may already have exited on its own (e.g. the
            // user ran `exit`). Log so this isn't invisible during debugging.
            log::debug!("pty_close: kill id={id} returned {e}");
        }
        log::info!("pty closed id={id}");
        // Detached: on Windows `ClosePseudoConsole` can block until conhost
        // drains, which would freeze this Tauri worker thread and stall IPC.
        thread::Builder::new()
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

impl PtyState {
    pub fn list_sessions(&self) -> Vec<PtySessionInfo> {
        let mut sessions: Vec<_> = self
            .metadata
            .read()
            .map(|metadata| metadata.values().cloned().collect())
            .unwrap_or_default();
        sessions.sort_by_key(|session| session.id);
        sessions
    }

    pub fn subscribe_output(&self, id: u32) -> Result<PtyOutputSubscription, String> {
        self.sessions
            .read()
            .unwrap()
            .get(&id)
            .cloned()
            .map(|session| session.subscribe_output())
            .ok_or_else(|| "no session".to_string())
    }

    pub fn output_snapshot(&self, id: u32) -> Result<Vec<u8>, String> {
        self.sessions
            .read()
            .unwrap()
            .get(&id)
            .cloned()
            .map(|session| session.output_snapshot())
            .ok_or_else(|| "no session".to_string())
    }

    pub fn write_remote(&self, id: u32, data: &str) -> Result<(), String> {
        let session = self
            .sessions
            .read()
            .unwrap()
            .get(&id)
            .cloned()
            .ok_or_else(|| "no session".to_string())?;
        let mut writer = session.writer.lock().unwrap();
        writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())
    }

    pub fn restore_desktop_size(&self, id: u32) -> Result<(), String> {
        let Some((cols, rows)) = self.sizes.read().unwrap().get(&id).copied() else {
            return Ok(());
        };
        let session = self
            .sessions
            .read()
            .unwrap()
            .get(&id)
            .cloned()
            .ok_or_else(|| "no session".to_string())?;
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
            .map_err(|e| e.to_string());
        result
    }
}
