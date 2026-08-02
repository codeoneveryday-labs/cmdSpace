mod modules;

use modules::{agent_usage, db, fs, git, net, pty, remote, secrets, shell, speech, workspace};
use std::sync::Mutex;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::{LogicalPosition, LogicalSize};
use tauri_plugin_window_state::StateFlags;

/// Drained on first read so HMR / re-mounts can't replay the launch dir.
#[derive(Default)]
struct LaunchDir(Mutex<Option<String>>);

#[cfg(any(target_os = "macos", target_os = "windows"))]
#[derive(Clone, Default)]
struct DesktopBlurState {
    transition: Arc<AtomicU64>,
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
#[derive(Default)]
struct DesktopBlurState {
    // Keep this non-unit on unsupported platforms so constructing the managed
    // state remains lint-clean under Clippy's cross-platform build.
    _unsupported: (),
}

#[cfg(all(test, target_os = "macos"))]
mod desktop_blur_tests {
    use super::desktop_blur_collection_behavior;

    #[test]
    fn desktop_blur_cold_start_does_not_block_on_frontend_ready() {
        let source = include_str!("lib.rs");
        let focus_mode = source
            .split_once("async fn set_desktop_blur(\n")
            .expect("set_desktop_blur must exist")
            .1
            .split_once("#[cfg_attr(mobile, tauri::mobile_entry_point)]")
            .expect("set_desktop_blur must end before run")
            .0;
        assert!(
            !focus_mode.contains("wait_for_overlay_ready("),
            "cold-start focus mode must fade immediately instead of waiting for a hidden webview handshake"
        );
    }

    #[test]
    fn desktop_blur_does_not_activate_or_focus_windows() {
        let source = include_str!("lib.rs");
        let focus_mode = source
            .split_once("async fn set_desktop_blur(\n")
            .expect("set_desktop_blur must exist")
            .1
            .split_once("#[cfg_attr(mobile, tauri::mobile_entry_point)]")
            .expect("set_desktop_blur must end before run")
            .0;

        assert!(
            !focus_mode.contains(".set_focus()"),
            "focus mode must preserve the active macOS application"
        );
        assert!(
            !focus_mode.contains("window.show()"),
            "focus mode must order windows without making them key"
        );
    }

    #[test]
    fn desktop_blur_does_not_participate_in_stage_manager_layout() {
        assert!(desktop_blur_collection_behavior()
            .contains(objc2_app_kit::NSWindowCollectionBehavior::CanJoinAllApplications));
    }

    #[test]
    fn desktop_blur_keeps_main_window_managed_by_stage_manager() {
        let source = include_str!("lib.rs");
        let focus_mode = source
            .split_once("async fn set_desktop_blur(\n")
            .expect("set_desktop_blur must exist")
            .1
            .split_once("#[cfg_attr(mobile, tauri::mobile_entry_point)]")
            .expect("set_desktop_blur must end before run")
            .0;
        let compact: String = focus_mode.split_whitespace().collect();

        assert!(
            !compact.contains("main_window.set_always_on_top(true)"),
            "focus mode must not turn the primary Stage Manager window into a floating window"
        );
        assert!(
            !compact.contains(
                "set_native_window_level(&main_window,objc2_app_kit::NSStatusWindowLevel+1)"
            ),
            "focus mode must keep the primary window at NSNormalWindowLevel"
        );
    }
}

#[cfg(test)]
mod windows_focus_mode_tests {
    #[test]
    fn focus_mode_uses_an_acrylic_non_activating_overlay_on_windows() {
        let source = include_str!("lib.rs");
        assert!(source.contains("Effect::Acrylic"));
        assert!(source.contains("set_windows_window_alpha(&window, 0)"));
        assert!(source.contains("order_windows_overlay_below(&window, &main_window)"));
        assert!(source.contains("SWP_NOACTIVATE"));
    }
}

#[cfg(target_os = "macos")]
fn set_native_window_alpha<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
    alpha: f64,
) -> Result<(), String> {
    let ns_window = window.ns_window().map_err(|e| e.to_string())? as usize;
    window
        .run_on_main_thread(move || unsafe {
            let ns_window = &*(ns_window as *mut objc2_app_kit::NSWindow);
            ns_window.setAlphaValue(alpha);
        })
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn desktop_blur_collection_behavior() -> objc2_app_kit::NSWindowCollectionBehavior {
    objc2_app_kit::NSWindowCollectionBehavior::CanJoinAllSpaces
        | objc2_app_kit::NSWindowCollectionBehavior::CanJoinAllApplications
        | objc2_app_kit::NSWindowCollectionBehavior::Stationary
        | objc2_app_kit::NSWindowCollectionBehavior::FullScreenAuxiliary
}

#[cfg(target_os = "macos")]
fn configure_desktop_blur_window<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Result<(), String> {
    let ns_window = window.ns_window().map_err(|e| e.to_string())? as usize;
    window
        .run_on_main_thread(move || unsafe {
            let ns_window = &*(ns_window as *mut objc2_app_kit::NSWindow);
            // Keep the overlay at the same level as the primary window so
            // Stage Manager does not replace cmdSpace with the previous app.
            ns_window.setLevel(objc2_app_kit::NSNormalWindowLevel);
            ns_window.setHidesOnDeactivate(false);
            ns_window.setCollectionBehavior(desktop_blur_collection_behavior());
        })
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn order_native_window_below<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
    relative_to: &tauri::WebviewWindow<R>,
) -> Result<(), String> {
    let ns_window = window.ns_window().map_err(|e| e.to_string())? as usize;
    let relative_to = relative_to.ns_window().map_err(|e| e.to_string())? as usize;
    window
        .run_on_main_thread(move || unsafe {
            let ns_window = &*(ns_window as *mut objc2_app_kit::NSWindow);
            let relative_to = &*(relative_to as *mut objc2_app_kit::NSWindow);
            ns_window.orderWindow_relativeTo(
                objc2_app_kit::NSWindowOrderingMode::Below,
                relative_to.windowNumber(),
            );
        })
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn set_windows_window_alpha<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
    alpha: u8,
) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetLayeredWindowAttributes, SetWindowLongPtrW, GWL_EXSTYLE, LWA_ALPHA,
        WS_EX_LAYERED,
    };

    // The raw HWND pointer is not Send, while Tauri requires callbacks passed
    // to `run_on_main_thread` to be Send. Preserve its address as an integer
    // and reconstruct the HWND inside the main-thread callback.
    let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as usize;
    window
        .run_on_main_thread(move || unsafe {
            let hwnd = hwnd as _;
            let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            if style & WS_EX_LAYERED as isize == 0 {
                let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED as isize);
            }
            let _ = SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA);
        })
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn order_windows_overlay_below<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
    relative_to: &tauri::WebviewWindow<R>,
) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOP, SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER,
        SWP_NOSIZE,
    };

    // See `set_windows_window_alpha`: integer addresses satisfy the Send
    // requirement until they are reconstructed on the Windows UI thread.
    let overlay = window.hwnd().map_err(|e| e.to_string())?.0 as usize;
    let main = relative_to.hwnd().map_err(|e| e.to_string())?.0 as usize;
    window
        .run_on_main_thread(move || unsafe {
            let overlay = overlay as _;
            let main = main as _;
            let flags =
                SWP_ASYNCWINDOWPOS | SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOOWNERZORDER | SWP_NOSIZE;
            // First make the blur layer the highest ordinary window, then put
            // cmdSpace directly above it. Neither operation activates a window.
            let _ = SetWindowPos(overlay, HWND_TOP, 0, 0, 0, 0, flags);
            let _ = SetWindowPos(main, overlay, 0, 0, 0, 0, flags);
        })
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn set_windows_desktop_blur(
    app: tauri::AppHandle,
    state: State<'_, DesktopBlurState>,
    enabled: bool,
) -> Result<(), String> {
    use tauri::window::{Effect, EffectState, EffectsBuilder};

    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is unavailable".to_string())?;
    let monitor = main_window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Current monitor is unavailable".to_string())?;
    let scale = monitor.scale_factor();
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let position = LogicalPosition::new(
        monitor_position.x as f64 / scale,
        monitor_position.y as f64 / scale,
    );
    let size = LogicalSize::new(
        monitor_size.width as f64 / scale,
        monitor_size.height as f64 / scale,
    );
    let transition_id = state.transition.fetch_add(1, Ordering::SeqCst) + 1;

    if !enabled {
        if let Some(window) = app.get_webview_window("desktop-blur") {
            window
                .emit("cmdspace:desktop-blur-transition", "off")
                .map_err(|e| e.to_string())?;

            let state = state.transition.clone();
            std::thread::spawn(move || {
                for step in (0..=12).rev() {
                    if state.load(Ordering::SeqCst) != transition_id {
                        return;
                    }
                    let alpha = (step * u8::MAX as usize / 12) as u8;
                    let _ = set_windows_window_alpha(&window, alpha);
                    std::thread::sleep(Duration::from_millis(92));
                }
                if state.load(Ordering::SeqCst) == transition_id {
                    let _ = window.hide();
                }
            });
        }
        return Ok(());
    }

    let window = if let Some(window) = app.get_webview_window("desktop-blur") {
        window.set_fullscreen(false).map_err(|e| e.to_string())?;
        window.set_position(position).map_err(|e| e.to_string())?;
        window.set_size(size).map_err(|e| e.to_string())?;
        window.set_focusable(false).map_err(|e| e.to_string())?;
        window
    } else {
        WebviewWindowBuilder::new(
            &app,
            "desktop-blur",
            WebviewUrl::App("index.html?desktop-blur-overlay=1".into()),
        )
        .title("cmdSpace desktop blur")
        .decorations(false)
        .transparent(true)
        .position(position.x, position.y)
        .inner_size(size.width, size.height)
        .focused(false)
        .focusable(false)
        .skip_taskbar(true)
        .shadow(false)
        .resizable(false)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?
    };

    window
        .set_ignore_cursor_events(true)
        .map_err(|e| e.to_string())?;
    window.set_focusable(false).map_err(|e| e.to_string())?;
    window
        .set_background_color(None)
        .map_err(|e| e.to_string())?;
    set_windows_window_alpha(&window, 0)?;
    window
        .set_effects(
            EffectsBuilder::new()
                .effect(Effect::Acrylic)
                .state(EffectState::Active)
                .build(),
        )
        .map_err(|e| e.to_string())?;
    // Showing at alpha zero prevents a flash; the explicit z-order preserves
    // the active cmdSpace window and leaves the overlay non-interactive.
    window.show().map_err(|e| e.to_string())?;
    order_windows_overlay_below(&window, &main_window)?;
    window
        .emit("cmdspace:desktop-blur-transition", "on")
        .map_err(|e| e.to_string())?;

    let state = state.transition.clone();
    std::thread::spawn(move || {
        for step in 0..=12 {
            if state.load(Ordering::SeqCst) != transition_id {
                return;
            }
            let alpha = (step * u8::MAX as usize / 12) as u8;
            let _ = set_windows_window_alpha(&window, alpha);
            std::thread::sleep(Duration::from_millis(92));
        }
    });
    Ok(())
}

#[tauri::command]
fn get_launch_dir(state: State<'_, LaunchDir>) -> Option<String> {
    state.0.lock().expect("LaunchDir mutex poisoned").take()
}

fn parse_launch_dir() -> Option<String> {
    for arg in std::env::args().skip(1) {
        if arg.starts_with('-') {
            continue;
        }
        let Ok(canon) = std::fs::canonicalize(&arg) else {
            continue;
        };
        if !canon.is_dir() {
            continue;
        }
        let s = canon.to_string_lossy();
        return Some(s.strip_prefix(r"\\?\").unwrap_or(&s).to_string());
    }
    None
}

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle, tab: Option<String>) -> Result<(), String> {
    let url_path = match tab.as_deref() {
        Some(t) if !t.is_empty() => format!("settings.html?tab={}", t),
        _ => "settings.html".to_string(),
    };

    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.set_focus();
        if let Some(t) = tab.as_deref().filter(|s| !s.is_empty()) {
            // emit() serializes via JSON — no string-escape footgun, unlike
            // eval() with format!(). Frontend listens via Tauri event API.
            let _ = window.emit("cmdspace:settings-tab", t);
        }
        return Ok(());
    }

    let mut builder = WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App(url_path.into()))
        .title("Settings")
        .inner_size(820.0, 620.0)
        .min_inner_size(820.0, 620.0)
        .max_inner_size(820.0, 620.0)
        .resizable(false)
        .visible(false)
        // Keep settings above the main app window so it doesn't get hidden
        // when the user clicks back into the editor or terminal (#33).
        .always_on_top(true);

    // Tie lifecycle to the main window so settings minimizes/closes with it.
    if let Some(main) = app.get_webview_window("main") {
        builder = builder.parent(&main).map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    // On Linux/Windows we render our own titlebar, so drop native chrome
    // and make the window transparent.
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let builder = builder.decorations(false).transparent(true);

    let window = builder.build().map_err(|e| e.to_string())?;

    // Some Linux compositors (GNOME/Mutter with CSD-by-default) ignore the
    // builder-time decorations flag — re-assert it after realize.
    #[cfg(target_os = "linux")]
    {
        let _ = window.set_decorations(false);
    }
    let _ = window;
    Ok(())
}

#[tauri::command]
async fn set_desktop_blur(
    app: tauri::AppHandle,
    state: State<'_, DesktopBlurState>,
    enabled: bool,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        set_windows_desktop_blur(app, state, enabled)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (app, state, enabled);
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        use tauri::window::{Effect, EffectState, EffectsBuilder};

        let main_window = app
            .get_webview_window("main")
            .ok_or_else(|| "Main window is unavailable".to_string())?;
        let monitor = main_window
            .current_monitor()
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Current monitor is unavailable".to_string())?;
        let scale = monitor.scale_factor();
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        let position = LogicalPosition::new(
            monitor_position.x as f64 / scale,
            monitor_position.y as f64 / scale,
        );
        let size = LogicalSize::new(
            monitor_size.width as f64 / scale,
            monitor_size.height as f64 / scale,
        );

        let transition_id = state.transition.fetch_add(1, Ordering::SeqCst) + 1;

        if !enabled {
            if let Some(window) = app.get_webview_window("desktop-blur") {
                window
                    .emit("cmdspace:desktop-blur-transition", "off")
                    .map_err(|e| e.to_string())?;

                let state = state.transition.clone();
                std::thread::spawn(move || {
                    for step in (0..=12).rev() {
                        if state.load(Ordering::SeqCst) != transition_id {
                            return;
                        }
                        let _ = set_native_window_alpha(&window, step as f64 / 12.0);
                        std::thread::sleep(Duration::from_millis(92));
                    }
                    if state.load(Ordering::SeqCst) == transition_id {
                        let _ = window.hide();
                    }
                });
            }
            return Ok(());
        }

        let window = if let Some(window) = app.get_webview_window("desktop-blur") {
            window.set_fullscreen(false).map_err(|e| e.to_string())?;
            window.set_position(position).map_err(|e| e.to_string())?;
            window.set_size(size).map_err(|e| e.to_string())?;
            window
                .set_visible_on_all_workspaces(true)
                .map_err(|e| e.to_string())?;
            window.set_focusable(false).map_err(|e| e.to_string())?;
            window
        } else {
            let window = WebviewWindowBuilder::new(
                &app,
                "desktop-blur",
                WebviewUrl::App("index.html?desktop-blur-overlay=1".into()),
            )
            .title("cmdSpace desktop blur")
            .decorations(false)
            .transparent(true)
            .position(position.x, position.y)
            .inner_size(size.width, size.height)
            .visible_on_all_workspaces(true)
            .focused(false)
            .focusable(false)
            .skip_taskbar(true)
            .shadow(false)
            .resizable(false)
            .visible(false)
            .build()
            .map_err(|e| e.to_string())?;
            window
        };

        window
            .set_ignore_cursor_events(true)
            .map_err(|e| e.to_string())?;
        window.set_focusable(false).map_err(|e| e.to_string())?;
        configure_desktop_blur_window(&window)?;
        window
            .set_background_color(None)
            .map_err(|e| e.to_string())?;
        set_native_window_alpha(&window, 0.0)?;
        window
            .set_effects(
                EffectsBuilder::new()
                    .effect(Effect::UnderWindowBackground)
                    .state(EffectState::Active)
                    .radius(0.0)
                    .build(),
            )
            .map_err(|e| e.to_string())?;
        // Relative native ordering shows the overlay directly behind cmdSpace
        // without making either window key or changing the primary window's
        // level. The latter is required for Stage Manager to keep cmdSpace as
        // the managed foreground application.
        order_native_window_below(&window, &main_window)?;

        window
            .emit("cmdspace:desktop-blur-transition", "on")
            .map_err(|e| e.to_string())?;

        let state = state.transition.clone();
        std::thread::spawn(move || {
            for step in 0..=12 {
                if state.load(Ordering::SeqCst) != transition_id {
                    return;
                }
                let _ = set_native_window_alpha(&window, step as f64 / 12.0);
                std::thread::sleep(Duration::from_millis(92));
            }
        });
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    workspace::init_launch_cwd();
    let db_conn = db::init_db().expect("Failed to initialize SQLite database");

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Skip restoring VISIBLE — frontend calls window.show() after first
        // paint so the user never sees a transparent window-shadow flash on
        // Windows/Linux.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(tauri_plugin_log::log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .manage(pty::PtyState::default())
        .manage(remote::RemoteAccessState::default())
        .manage(shell::ShellState::default())
        .manage(secrets::SecretsState::default())
        .manage({
            let registry = workspace::WorkspaceRegistry::default();
            workspace::bootstrap_registry(&registry);
            registry
        })
        .manage(LaunchDir(Mutex::new(parse_launch_dir())))
        .manage(DesktopBlurState::default())
        .manage(db::DbState(std::sync::Mutex::new(db_conn)))
        .invoke_handler(tauri::generate_handler![
            agent_usage::agent_usage_statuses,
            pty::pty_open,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_close,
            pty::pty_register_metadata,
            pty::pty_list,
            fs::tree::list_subdirs,
            fs::tree::fs_read_dir,
            fs::file::fs_read_file,
            fs::file::fs_read_image,
            fs::file::fs_read_video,
            fs::file::fs_write_file,
            fs::file::fs_stat,
            fs::file::select_folder,
            fs::file::fs_canonicalize,
            fs::mutate::fs_create_file,
            fs::mutate::fs_create_dir,
            fs::mutate::fs_rename,
            fs::mutate::fs_import_paths,
            fs::mutate::fs_import_clipboard_file,
            fs::mutate::fs_clipboard_paths,
            fs::mutate::fs_delete,
            fs::mutate::fs_restore,
            fs::search::fs_search,
            fs::search::fs_list_files,
            fs::grep::fs_grep,
            fs::grep::fs_glob,
            git::commands::git_resolve_repo,
            git::commands::git_panel_snapshot,
            git::commands::git_status,
            git::commands::git_diff,
            git::commands::git_diff_content,
            git::commands::git_stage,
            git::commands::git_unstage,
            git::commands::git_discard,
            git::commands::git_commit,
            git::commands::git_fetch,
            git::commands::git_pull_ff_only,
            git::commands::git_push,
            git::commands::git_log,
            git::commands::git_show_commit,
            git::commands::git_commit_files,
            git::commands::git_commit_file_diff,
            git::commands::git_remote_url,
            shell::shell_run_command,
            shell::shell_session_open,
            shell::shell_session_run,
            shell::shell_session_close,
            shell::shell_bg_spawn,
            shell::shell_bg_logs,
            shell::shell_bg_kill,
            shell::shell_bg_list,
            workspace::wsl_list_distros,
            workspace::wsl_default_distro,
            workspace::wsl_home,
            workspace::workspace_authorize,
            workspace::workspace_current_dir,
            workspace::app_dev_repo_root,
            get_launch_dir,
            open_settings_window,
            set_desktop_blur,
            secrets::secrets_get,
            secrets::secrets_set,
            secrets::secrets_delete,
            secrets::secrets_get_all,
            net::lm_ping,
            net::ai_http_request,
            net::ai_http_stream,
            remote::remote_access_status,
            remote::remote_access_start,
            remote::remote_access_stop,
            remote::remote_access_reset_password,
            speech::speech_supported_locales,
            speech::speech_start,
            speech::speech_stop,
            db::db_list_workspaces,
            db::db_save_workspace,
            db::db_delete_workspace,
            db::db_reorder_workspaces,
            db::db_list_panes,
            db::db_save_pane,
            db::db_list_recent_workspaces,
            db::db_save_recent_workspace,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
