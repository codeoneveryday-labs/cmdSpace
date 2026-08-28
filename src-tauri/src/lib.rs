mod modules;

use modules::{
    agent_chat, agent_usage, db, fs, git, music, net, pty, remote, secrets, shell, speech,
    workspace,
};
use std::sync::Mutex;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
#[cfg(target_os = "macos")]
use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    PhysicalPosition,
};
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::{LogicalPosition, LogicalSize};
use tauri_plugin_window_state::StateFlags;

#[cfg(target_os = "macos")]
#[tauri::command]
fn set_webview_corner_radius(
    app: tauri::AppHandle,
    label: String,
    radius: f64,
) -> Result<(), String> {
    use objc2::{msg_send, runtime::AnyObject};

    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview '{label}' was not found"))?;

    webview
        .with_webview(move |platform_webview| unsafe {
            let view = &*(platform_webview.inner() as *const AnyObject);
            let _: () = msg_send![view, setWantsLayer: true];
            let layer: *mut AnyObject = msg_send![view, layer];
            if let Some(layer) = layer.as_ref() {
                let _: () = msg_send![layer, setCornerRadius: radius];
                let _: () = msg_send![layer, setMasksToBounds: true];
            }
        })
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn set_webview_corner_radius(
    _app: tauri::AppHandle,
    _label: String,
    _radius: f64,
) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
const WORKSPACE_TRAY_ID: &str = "cmdspace-workspaces";
const WORKSPACE_SWITCHER_LABEL: &str = "tray";
#[cfg(target_os = "macos")]
const WORKSPACE_SWITCHER_WIDTH: f64 = 420.0;
#[cfg(target_os = "macos")]
const WORKSPACE_SWITCHER_HEIGHT: f64 = 520.0;

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

macro_rules! cmdspace_commands {
    () => {
        tauri::generate_handler![
            // Agent usage
            agent_usage::agent_usage_statuses,
            agent_usage::provider_limit_status,
            agent_usage::provider_limit_statuses,
            // Structured CLI agent chat
            agent_chat::agent_chat_start,
            agent_chat::agent_chat_send,
            agent_chat::agent_chat_cancel,
            agent_chat::agent_chat_close,
            agent_chat::agent_chat_load_history,
            agent_chat::agent_chat_list_models,
            agent_chat::agent_chat_list_slash_options,
            // PTY
            pty::pty_open,
            pty::pty_write,
            pty::pty_trace_input,
            pty::pty_resize,
            pty::pty_close,
            pty::pty_register_metadata,
            pty::pty_list,
            pty::pty_available_shells,
            pty::check_agent_clis,
            pty::list_agent_sessions,
            // Filesystem
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
            // Git
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
            // Shell
            shell::shell_run_command,
            shell::shell_session_open,
            shell::shell_session_run,
            shell::shell_session_close,
            shell::shell_bg_spawn,
            shell::shell_bg_logs,
            shell::shell_bg_kill,
            shell::shell_bg_list,
            // Workspace
            workspace::wsl_list_distros,
            workspace::wsl_default_distro,
            workspace::wsl_home,
            workspace::workspace_authorize,
            workspace::workspace_current_dir,
            workspace::app_dev_repo_root,
            // Window surfaces
            get_launch_dir,
            open_settings_window,
            hide_workspace_switcher,
            open_workspace_from_tray,
            set_desktop_blur,
            set_webview_corner_radius,
            // Secrets
            secrets::secrets_get,
            secrets::secrets_set,
            secrets::secrets_delete,
            secrets::secrets_get_all,
            // Network / AI transport
            net::lm_ping,
            net::ai_http_request,
            net::ai_http_stream,
            // Music
            music::music_is_playing,
            music::install_music_cli_script,
            // Remote access
            remote::remote_access_status,
            remote::remote_access_start,
            remote::remote_access_stop,
            remote::remote_access_reset_password,
            remote::remote_device_pairing_start,
            remote::remote_device_list,
            remote::remote_device_revoke,
            // Speech
            speech::speech_supported_locales,
            speech::speech_start,
            speech::speech_stop,
            // Database / persistence
            db::db_list_workspaces,
            db::db_save_workspace,
            db::db_delete_workspace,
            db::db_reorder_workspaces,
            db::db_list_panes,
            db::db_save_pane,
            db::db_list_recent_workspaces,
            db::db_save_recent_workspace,
            db::db_load_workspace_setup_custom_command,
            db::db_save_workspace_setup_custom_command,
            db::db_load_agent_chat_config,
            db::db_save_agent_chat_config,
            db::db_load_agent_model_cache,
            db::db_save_agent_model_cache,
        ]
    };
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

#[cfg(test)]
mod native_command_registration_tests {
    #[test]
    fn invoke_handler_uses_the_grouped_native_command_macro() {
        let source = include_str!("lib.rs");
        let run_body = source
            .split_once("#[cfg_attr(mobile, tauri::mobile_entry_point)]\npub fn run() {\n")
            .expect("run() must exist")
            .1;

        assert!(
            run_body.contains(".invoke_handler(cmdspace_commands!())"),
            "run() should register commands through the grouped cmdspace_commands! macro"
        );
    }

    #[test]
    fn grouped_native_command_macro_keeps_domain_sections_together() {
        let source = include_str!("lib.rs");
        let prelude = source
            .split_once("#[cfg(test)]\nmod native_command_registration_tests")
            .expect("native command registration tests must exist after the macro definitions")
            .0;

        assert!(
            prelude.contains("macro_rules! cmdspace_commands"),
            "lib.rs should define a top-level grouped command macro"
        );
        assert!(
            prelude.contains("// Agent usage")
                && prelude.contains("// PTY")
                && prelude.contains("// Filesystem")
                && prelude.contains("// Git")
                && prelude.contains("// Shell")
                && prelude.contains("// Workspace")
                && prelude.contains("// Window surfaces")
                && prelude.contains("// Secrets")
                && prelude.contains("// Network / AI transport")
                && prelude.contains("// Music")
                && prelude.contains("// Remote access")
                && prelude.contains("// Speech")
                && prelude.contains("// Database / persistence"),
            "cmdspace_commands! should group registrations into domain sections"
        );
    }

    #[test]
    fn grouped_native_command_macro_keeps_preview_corner_radius_command() {
        let source = include_str!("lib.rs");

        assert!(
            source.contains("set_desktop_blur,\n            set_webview_corner_radius,"),
            "the preview corner-radius command must remain registered with window surface commands"
        );
    }

    #[test]
    fn macos_new_tab_menu_routes_to_the_react_tab_event() {
        let source = include_str!("lib.rs");

        assert!(source.contains("MenuItem::with_id("));
        assert!(source.contains("\"cmdspace.new-tab\""));
        assert!(source.contains("\"New Tab\""));
        assert!(source.contains("Some(\"CmdOrCtrl+T\")"));
        assert!(source.contains("app.emit(\"cmdspace:new-tab\", ())"));
    }

    #[test]
    fn macos_maximize_pane_menu_routes_to_the_react_pane_event() {
        let source = include_str!("lib.rs");

        assert!(source.contains("\"cmdspace.maximize-pane\""));
        assert!(source.contains("\"Maximize Pane\""));
        assert!(source.contains("Some(\"CmdOrCtrl+Shift+Period\")"));
        assert!(source.contains("app.emit(\"cmdspace:maximize-pane\", ())"));
    }

    #[test]
    fn macos_shortcuts_menu_routes_to_the_react_dialog_event() {
        let source = include_str!("lib.rs");

        assert!(source.contains("\"cmdspace.open-shortcuts\""));
        assert!(source.contains("\"Keyboard Shortcuts\""));
        assert!(source.contains("Some(\"CmdOrCtrl+K\")"));
        assert!(source.contains("app.emit(\"cmdspace:open-shortcuts\", ())"));
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

#[cfg(target_os = "macos")]
#[derive(Clone, Copy)]
struct WorkspaceSwitcherRect {
    left: f64,
    top: f64,
    width: f64,
    height: f64,
}

#[cfg(target_os = "macos")]
fn workspace_switcher_position(
    tray: WorkspaceSwitcherRect,
    monitor: WorkspaceSwitcherRect,
    popup: WorkspaceSwitcherRect,
) -> PhysicalPosition<i32> {
    const EDGE_GAP: f64 = 8.0;
    const TRAY_GAP: f64 = 2.0;

    let minimum_x = monitor.left + EDGE_GAP;
    let maximum_x = (monitor.left + monitor.width - popup.width - EDGE_GAP).max(minimum_x);
    let x = (tray.left + tray.width / 2.0 - popup.width / 2.0).clamp(minimum_x, maximum_x);

    let minimum_y = monitor.top + EDGE_GAP;
    let maximum_y = (monitor.top + monitor.height - popup.height - EDGE_GAP).max(minimum_y);
    let y = (tray.top + tray.height + TRAY_GAP).clamp(minimum_y, maximum_y);

    PhysicalPosition::new(x.round() as i32, y.round() as i32)
}

#[cfg(target_os = "macos")]
fn show_workspace_switcher(
    app: &tauri::AppHandle,
    tray_rect: tauri::Rect,
    click_position: tauri::PhysicalPosition<f64>,
) -> Result<(), String> {
    let window = app
        .get_webview_window(WORKSPACE_SWITCHER_LABEL)
        .ok_or_else(|| "Workspace switcher window is unavailable".to_string())?;

    if window.is_visible().unwrap_or(false) {
        window.hide().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let monitors = window
        .available_monitors()
        .map_err(|error| error.to_string())?;
    let monitor = monitors
        .iter()
        .find(|monitor| {
            let position = monitor.position();
            let size = monitor.size();
            click_position.x >= position.x as f64
                && click_position.x < (position.x + size.width as i32) as f64
                && click_position.y >= position.y as f64
                && click_position.y < (position.y + size.height as i32) as f64
        })
        .or_else(|| monitors.first())
        .ok_or_else(|| "No display is available for the workspace switcher".to_string())?;

    let scale_factor = monitor.scale_factor();
    let tray_position = tray_rect.position.to_physical::<i32>(scale_factor);
    let tray_size = tray_rect.size.to_physical::<u32>(scale_factor);
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let popup_position = workspace_switcher_position(
        WorkspaceSwitcherRect {
            left: tray_position.x as f64,
            top: tray_position.y as f64,
            width: tray_size.width as f64,
            height: tray_size.height as f64,
        },
        WorkspaceSwitcherRect {
            left: monitor_position.x as f64,
            top: monitor_position.y as f64,
            width: monitor_size.width as f64,
            height: monitor_size.height as f64,
        },
        WorkspaceSwitcherRect {
            left: 0.0,
            top: 0.0,
            width: WORKSPACE_SWITCHER_WIDTH * scale_factor,
            height: WORKSPACE_SWITCHER_HEIGHT * scale_factor,
        },
    );

    window
        .set_position(popup_position)
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    window
        .emit("cmdspace:tray-opened", ())
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn setup_workspace_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    WebviewWindowBuilder::new(
        app,
        WORKSPACE_SWITCHER_LABEL,
        WebviewUrl::App("tray.html".into()),
    )
    .title("cmdSpace Workspaces")
    .inner_size(WORKSPACE_SWITCHER_WIDTH, WORKSPACE_SWITCHER_HEIGHT)
    .min_inner_size(WORKSPACE_SWITCHER_WIDTH, WORKSPACE_SWITCHER_HEIGHT)
    .max_inner_size(WORKSPACE_SWITCHER_WIDTH, WORKSPACE_SWITCHER_HEIGHT)
    .resizable(false)
    .visible(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .visible_on_all_workspaces(true)
    .skip_taskbar(true)
    .shadow(false)
    .build()?;

    let tray = TrayIconBuilder::with_id(WORKSPACE_TRAY_ID)
        .tooltip("cmdSpace Workspaces")
        .show_menu_on_left_click(false)
        .icon_as_template(true)
        .icon(tauri::include_image!("icons/trayTemplate.png"))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                rect,
                position,
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Err(error) = show_workspace_switcher(tray.app_handle(), rect, position) {
                    log::error!("Failed to toggle workspace switcher: {error}");
                }
            }
        });
    tray.build(app)?;
    Ok(())
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn hide_workspace_switcher(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WORKSPACE_SWITCHER_LABEL) {
        window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn hide_workspace_switcher() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn open_workspace_from_tray(app: tauri::AppHandle, workspace_id: String) -> Result<(), String> {
    if workspace_id.trim().is_empty() {
        return Err("Workspace ID must not be empty".to_string());
    }

    if let Some(window) = app.get_webview_window(WORKSPACE_SWITCHER_LABEL) {
        let _ = window.hide();
    }
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is unavailable".to_string())?;
    let _ = main.unminimize();
    main.show().map_err(|error| error.to_string())?;
    main.set_focus().map_err(|error| error.to_string())?;
    main.emit("cmdspace:open-workspace", workspace_id)
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(all(test, target_os = "macos"))]
mod workspace_switcher_tests {
    use super::{workspace_switcher_position, WorkspaceSwitcherRect};

    fn rect(left: f64, top: f64, width: f64, height: f64) -> WorkspaceSwitcherRect {
        WorkspaceSwitcherRect {
            left,
            top,
            width,
            height,
        }
    }

    #[test]
    fn centers_the_popup_under_the_tray_icon() {
        let position = workspace_switcher_position(
            rect(900.0, 0.0, 44.0, 48.0),
            rect(0.0, 0.0, 1920.0, 1200.0),
            rect(0.0, 0.0, 840.0, 1040.0),
        );

        assert_eq!(position.x, 502);
        assert_eq!(position.y, 50);
    }

    #[test]
    fn clamps_the_popup_inside_the_display_edges() {
        let left = workspace_switcher_position(
            rect(-1260.0, 0.0, 44.0, 48.0),
            rect(-1280.0, 0.0, 1280.0, 1200.0),
            rect(0.0, 0.0, 840.0, 1040.0),
        );
        let right = workspace_switcher_position(
            rect(1900.0, 0.0, 44.0, 48.0),
            rect(0.0, 0.0, 1920.0, 1200.0),
            rect(0.0, 0.0, 840.0, 1040.0),
        );

        assert_eq!(left.x, -1272);
        assert_eq!(right.x, 1072);
    }
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

    let builder = tauri::Builder::default();

    // Register Cmd+T with the native menu so macOS does not let WebKit handle
    // it as a browser-style new window before the React shortcut listener runs.
    #[cfg(target_os = "macos")]
    let builder = builder
        .menu(|app| {
            let menu = Menu::default(app)?;
            let app_menu_name = app.package_info().name.clone();
            let app_menu = menu.items()?.into_iter().find_map(|item| {
                let submenu = item.as_submenu()?.clone();
                (submenu.text().ok()? == app_menu_name).then_some(submenu)
            });
            if let Some(app_menu) = app_menu {
                // Replace Tauri's default About item so macOS uses cmdSpace's
                // bundle artwork instead of the generic folder placeholder.
                app_menu.remove_at(0)?;
                let about = PredefinedMenuItem::about(
                    app,
                    None,
                    Some(AboutMetadata {
                        name: Some(app.package_info().name.clone()),
                        version: Some(app.package_info().version.to_string()),
                        copyright: app.config().bundle.copyright.clone(),
                        icon: Some(tauri::include_image!("icons/about.png")),
                        ..Default::default()
                    }),
                )?;
                app_menu.prepend(&about)?;
            }
            let new_tab = MenuItem::with_id(
                app,
                "cmdspace.new-tab",
                "New Tab",
                true,
                Some("CmdOrCtrl+T"),
            )?;
            let maximize_pane = MenuItem::with_id(
                app,
                "cmdspace.maximize-pane",
                "Maximize Pane",
                true,
                Some("CmdOrCtrl+Shift+Period"),
            )?;
            let open_shortcuts = MenuItem::with_id(
                app,
                "cmdspace.open-shortcuts",
                "Keyboard Shortcuts",
                true,
                Some("CmdOrCtrl+K"),
            )?;

            if let Some(file_menu) = menu.get("File").and_then(|item| item.as_submenu().cloned()) {
                file_menu.prepend(&new_tab)?;
            }
            if let Some(view_menu) = menu.get("View").and_then(|item| item.as_submenu().cloned()) {
                view_menu.prepend(&maximize_pane)?;
                view_menu.prepend(&open_shortcuts)?;
            }

            Ok(menu)
        })
        .on_menu_event(|app, event| {
            if event.id() == "cmdspace.new-tab" {
                let _ = app.emit("cmdspace:new-tab", ());
            }
            if event.id() == "cmdspace.maximize-pane" {
                let _ = app.emit("cmdspace:maximize-pane", ());
            }
            if event.id() == "cmdspace.open-shortcuts" {
                let _ = app.emit("cmdspace:open-shortcuts", ());
            }
        });

    builder
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
        .manage(agent_chat::AgentChatRuntime::default())
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
        .setup(|_app| {
            #[cfg(target_os = "macos")]
            setup_workspace_tray(_app)?;
            Ok(())
        })
        .invoke_handler(cmdspace_commands!())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
