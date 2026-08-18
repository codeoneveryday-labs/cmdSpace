mod agent_detect;
mod da_filter;
#[cfg(windows)]
mod job;
mod session;
pub(crate) mod session_import;
pub(crate) mod shell_init;

use std::collections::{hash_map::DefaultHasher, HashMap};
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, RwLock};
use std::thread;

use portable_pty::PtySize;
use serde::Serialize;
use tauri::ipc::{Channel, Response};

use crate::modules::workspace::{authorize_spawn_cwd, WorkspaceEnv, WorkspaceRegistry};
use session::Session;

/// Names that always resolve to the Windows built-in shell even when the
/// Command Code CLI (`cmd`) isn't installed. A PATH hit on these must not be
/// reported as "installed".
#[cfg(windows)]
const WINDOWS_BUILTIN_SHELL_EXES: &[&str] = &["cmd.exe"];

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

#[tauri::command]
pub fn pty_available_shells() -> Vec<String> {
    shell_init::available_shells()
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
pub fn pty_trace_input(source: String, data: String) {
    let mut hasher = DefaultHasher::new();
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

fn path_entries() -> Vec<std::path::PathBuf> {
    std::env::var_os("PATH")
        .map(|path| std::env::split_paths(&path).collect())
        .unwrap_or_default()
}

/// Extra directories that GUI-launched apps usually miss: macOS apps launched
/// from Finder/Dock inherit a minimal PATH that excludes Homebrew, and npm
/// global installs live under the user's home. PTY shells get these via
/// login/profile scripts, so this keeps detection in sync with the terminal.
#[cfg(unix)]
fn user_bin_dirs() -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join(".local").join("bin"));
        dirs.push(home.join(".npm-global").join("bin"));
        dirs.push(home.join(".cargo").join("bin"));
        dirs.push(home.join(".codex").join("bin"));
        dirs.push(home.join(".claude").join("local").join("bin"));
    }
    #[cfg(target_os = "macos")]
    {
        dirs.push(std::path::PathBuf::from("/opt/homebrew/bin"));
        dirs.push(std::path::PathBuf::from("/usr/local/bin"));
    }
    dirs
}

/// Ask a login shell what PATH the user would actually have in the terminal.
/// `sh -lc` runs path_helper on macOS (restores Homebrew); `$SHELL -lic` then
/// picks up `.zshrc`/`.bashrc` exports. Output is a colon-separated path list.
#[cfg(unix)]
fn login_shell_path_entries() -> Vec<std::path::PathBuf> {
    use std::process::Command;
    let probe = || -> Option<Vec<std::path::PathBuf>> {
        let sh = std::env::var("SHELL").ok().filter(|s| !s.is_empty())?;
        let login_out = Command::new("sh")
            .arg("-lc")
            .arg("printf '%s' \"$PATH\"")
            .output()
            .ok()?;
        if !login_out.status.success() {
            return None;
        }
        let login_path = String::from_utf8(login_out.stdout).ok()?;
        let mut entries: Vec<std::path::PathBuf> = std::env::split_paths(&login_path).collect();
        if sh.contains("zsh") || sh.contains("bash") {
            let interactive_out = Command::new(&sh)
                .arg("-lic")
                .arg("printf '%s' \"$PATH\"")
                .output()
                .ok()?;
            if interactive_out.status.success() {
                let interactive_path = String::from_utf8(interactive_out.stdout).ok()?;
                entries = std::env::split_paths(&interactive_path).collect();
            }
        }
        Some(entries)
    };
    probe().unwrap_or_default()
}

fn is_executable_file(path: &std::path::Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        path.is_file()
            && std::fs::metadata(path)
                .map(|m| m.permissions().mode() & 0o111 != 0)
                .unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

/// True when `name` resolves to an executable file inside any of `dirs`,
/// trying each of `exts` (empty string = the bare name). Windows built-in
/// shell names (e.g. `cmd.exe` in System32) are excluded so the Command Code
/// CLI isn't conflated with the OS shell.
fn resolvable_in_dirs(name: &str, dirs: &[std::path::PathBuf], exts: &[String]) -> bool {
    if name.trim().is_empty() {
        return false;
    }
    dirs.iter().any(|dir| {
        exts.iter().any(|ext| {
            let candidate = dir.join(format!("{name}{ext}"));
            if !is_executable_file(&candidate) {
                return false;
            }
            #[cfg(windows)]
            {
                let lower = candidate
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.to_ascii_lowercase())
                    .unwrap_or_default();
                if WINDOWS_BUILTIN_SHELL_EXES.contains(&lower.as_str()) {
                    return !is_windows_system32_path(&candidate);
                }
            }
            true
        })
    })
}

#[tauri::command]
pub fn check_agent_clis(
    names: Vec<String>,
    workspace: Option<WorkspaceEnv>,
) -> Result<Vec<bool>, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    if workspace.is_wsl() {
        #[cfg(windows)]
        {
            return check_agent_clis_wsl(&workspace, &names);
        }
        #[cfg(not(windows))]
        {
            // WSL env is meaningless off Windows; treat as local.
            let _ = &workspace;
        }
    }

    #[cfg(windows)]
    let mut path_exts: Vec<String> = std::env::var("PATHEXT")
        .map(|value| {
            value
                .split(';')
                .filter(|ext| !ext.is_empty())
                .map(|ext| ext.to_ascii_lowercase())
                .collect()
        })
        .unwrap_or_else(|_| vec![".exe".into(), ".cmd".into(), ".bat".into(), ".com".into()]);
    #[cfg(windows)]
    {
        // Always probe plain names too (a no-extension shim or a unix-style
        // binary copied into a PATH dir still works from `cmd` on Windows).
        path_exts.insert(0, String::new());
    }
    #[cfg(not(windows))]
    let path_exts: Vec<String> = vec![String::new()];

    #[allow(unused_mut)]
    let mut entries = path_entries();
    #[cfg(unix)]
    {
        // GUI-launched apps on macOS get a minimal PATH (missing Homebrew);
        // fall back to the login shell's PATH and common user bin dirs so an
        // agent the user can run in a terminal isn't reported as "not installed".
        entries.extend(user_bin_dirs());
        entries.extend(login_shell_path_entries());
    }
    Ok(names
        .iter()
        .map(|name| resolvable_in_dirs(name, &entries, &path_exts))
        .collect())
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

#[cfg(windows)]
fn is_windows_system32_path(path: &std::path::Path) -> bool {
    let system_root = std::env::var_os("SystemRoot")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from(r"C:\Windows"));
    let system32 = system_root.join("System32");
    let path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    path.starts_with(&system32)
}

#[cfg(windows)]
fn check_agent_clis_wsl(workspace: &WorkspaceEnv, names: &[String]) -> Result<Vec<bool>, String> {
    let WorkspaceEnv::Wsl { distro } = workspace else {
        return Ok(vec![false; names.len()]);
    };
    crate::modules::workspace::validate_wsl_distro_name(distro)?;
    let script = names
        .iter()
        .map(|name| {
            // command -v prints the path when found; empty when not. Quote so a
            // malicious name can't inject shell.
            format!(
                "command -v '{}' >/dev/null 2>&1; printf '%s\\n' $?",
                name.replace('\'', "'\\''")
            )
        })
        .collect::<Vec<_>>()
        .join("");
    let out = crate::modules::workspace::wsl_exec_capture(distro, "sh", &["-c", &script])?;
    let flags: Vec<bool> = out.lines().map(|line| line.trim() == "0").collect();
    // A distro that returns fewer lines than names is a bug; pad with false.
    let mut flags = flags;
    flags.resize(names.len(), false);
    Ok(flags)
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

#[cfg(test)]
mod cli_probe_tests {
    use super::*;
    use std::fs;

    fn temp_bin_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "cmdspace-cli-probe-{tag}-{}-{}",
            std::process::id(),
            std::thread::current().name().unwrap_or("unnamed")
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp bin dir");
        dir
    }

    fn cleanup(dir: &std::path::Path) {
        let _ = fs::remove_dir_all(dir);
    }

    #[cfg(unix)]
    #[test]
    fn user_bin_dirs_contains_home_local_bin() {
        let dirs = user_bin_dirs();
        let home = dirs::home_dir().expect("home dir");
        assert!(dirs.contains(&home.join(".local").join("bin")));
        assert!(dirs.contains(&home.join(".npm-global").join("bin")));
    }

    #[test]
    fn finds_bare_name_on_unix_style_path() {
        let dir = temp_bin_dir("bare");
        fs::write(dir.join("codex"), "#!/bin/sh\n").expect("write codex");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(dir.join("codex"))
                .expect("stat codex")
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(dir.join("codex"), perms).expect("chmod codex");
        }
        let dirs = vec![dir.clone()];
        let exts = vec![String::new()];
        assert!(resolvable_in_dirs("codex", &dirs, &exts));
        assert!(!resolvable_in_dirs("claude", &dirs, &exts));
        cleanup(&dir);
    }

    #[test]
    fn respects_pathext_style_extensions() {
        let dir = temp_bin_dir("ext");
        fs::write(dir.join("claude.exe"), "x").expect("write claude.exe");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(dir.join("claude.exe"))
                .expect("stat claude.exe")
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(dir.join("claude.exe"), perms).expect("chmod claude.exe");
        }
        let dirs = vec![dir.clone()];
        let exts = vec![
            String::new(),
            ".exe".to_string(),
            ".cmd".to_string(),
            ".bat".to_string(),
        ];
        assert!(resolvable_in_dirs("claude", &dirs, &exts));
        // A `.exe`-only probe must not find a bare file.
        let exts_exe = vec![String::new(), ".exe".to_string()];
        assert!(!resolvable_in_dirs("codex", &dirs, &exts_exe));
        cleanup(&dir);
    }

    #[cfg(windows)]
    #[test]
    fn system32_cmd_exe_is_rejected() {
        let candidate = std::path::PathBuf::from(r"C:\Windows\System32\cmd.exe");
        assert!(is_windows_system32_path(&candidate));
        let dirs = vec![std::path::PathBuf::from(r"C:\Windows\System32")];
        let exts = vec![String::new(), ".exe".to_string()];
        assert!(!resolvable_in_dirs("cmd", &dirs, &exts));
    }

    #[cfg(windows)]
    #[test]
    fn user_path_cmd_exe_is_accepted() {
        let candidate = std::path::PathBuf::from(r"C:\Users\me\AppData\Roaming\npm\cmd.exe");
        assert!(!is_windows_system32_path(&candidate));
        let dirs = vec![std::path::PathBuf::from(r"C:\Users\me\AppData\Roaming\npm")];
        let exts = vec![String::new(), ".exe".to_string()];
        assert!(resolvable_in_dirs("cmd", &dirs, &exts));
    }
}
