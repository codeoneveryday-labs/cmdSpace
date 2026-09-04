mod app_exit;
#[cfg(target_os = "macos")]
mod app_menu;
mod commands;
mod modules;
mod window_commands;

use modules::{
    agent_chat, agent_usage, db, fs, git, music, net, pty, remote, secrets, shell, sleep, speech,
    workspace,
};
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

#[cfg(all(test, target_os = "macos"))]
mod desktop_blur_tests {
    use super::window_commands::desktop_blur_collection_behavior;

    #[test]
    fn desktop_blur_cold_start_does_not_block_on_frontend_ready() {
        let source = include_str!("window_desktop_blur.rs");
        let focus_mode = source
            .split_once("async fn set_desktop_blur_impl(\n")
            .expect("set_desktop_blur_impl must exist")
            .1;
        assert!(
            !focus_mode.contains("wait_for_overlay_ready("),
            "cold-start focus mode must fade immediately instead of waiting for a hidden webview handshake"
        );
    }

    #[test]
    fn desktop_blur_does_not_activate_or_focus_windows() {
        let source = include_str!("window_desktop_blur.rs");
        let focus_mode = source
            .split_once("async fn set_desktop_blur_impl(\n")
            .expect("set_desktop_blur_impl must exist")
            .1;

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
        let source = include_str!("window_desktop_blur.rs");
        let focus_mode = source
            .split_once("async fn set_desktop_blur_impl(\n")
            .expect("set_desktop_blur_impl must exist")
            .1;
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
        let source = include_str!("window_desktop_blur.rs");
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
        let commands = include_str!("commands.rs");
        assert!(
            commands.contains("macro_rules! cmdspace_commands"),
            "commands.rs should define a grouped command macro"
        );
        assert!(
            commands.contains("// Agent usage")
                && commands.contains("// PTY")
                && commands.contains("// Filesystem")
                && commands.contains("// Git")
                && commands.contains("// Shell")
                && commands.contains("// Workspace")
                && commands.contains("// Window surfaces")
                && commands.contains("// Secrets")
                && commands.contains("// Network / AI transport")
                && commands.contains("// Music")
                && commands.contains("// Remote access")
                && commands.contains("// Speech")
                && commands.contains("// Database / persistence"),
            "cmdspace_commands! should group registrations into domain sections"
        );
    }

    #[test]
    fn grouped_native_command_macro_drops_removed_browser_commands() {
        let source = include_str!("commands.rs");

        assert!(
            !source.contains("window_commands::set_webview_corner_radius,"),
            "the removed browser corner-radius command must stay unregistered"
        );
    }

    #[test]
    fn macos_new_tab_menu_routes_to_the_react_tab_event() {
        let source = include_str!("app_menu.rs");

        assert!(source.contains("MenuItem::with_id("));
        assert!(source.contains("\"cmdspace.new-tab\""));
        assert!(source.contains("\"New Tab\""));
        assert!(source.contains("Some(\"CmdOrCtrl+T\")"));
        assert!(source.contains("app.emit(\"cmdspace:new-tab\", ())"));
    }

    #[test]
    fn macos_maximize_pane_menu_routes_to_the_react_pane_event() {
        let source = include_str!("app_menu.rs");

        assert!(source.contains("\"cmdspace.maximize-pane\""));
        assert!(source.contains("\"Maximize Pane\""));
        assert!(source.contains("Some(\"CmdOrCtrl+Shift+Period\")"));
        assert!(source.contains("app.emit(\"cmdspace:maximize-pane\", ())"));
    }

    #[test]
    fn macos_shortcuts_menu_routes_to_the_react_dialog_event() {
        let source = include_str!("app_menu.rs");

        assert!(source.contains("\"cmdspace.open-shortcuts\""));
        assert!(source.contains("\"Keyboard Shortcuts\""));
        assert!(source.contains("Some(\"CmdOrCtrl+K\")"));
        assert!(source.contains("app.emit(\"cmdspace:open-shortcuts\", ())"));
    }
}

#[cfg(all(test, target_os = "macos"))]
mod workspace_switcher_tests {
    use super::window_commands::{workspace_switcher_position, WorkspaceSwitcherRect};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    workspace::init_launch_cwd();
    let db_conn = db::init_db().expect("Failed to initialize SQLite database");

    let builder = tauri::Builder::default();

    // Register native shortcuts so WebKit does not handle them as browser actions.
    #[cfg(target_os = "macos")]
    let builder = builder
        .menu(app_menu::build)
        .on_menu_event(app_menu::handle);

    let app = builder
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
        .manage(window_commands::LaunchDir(Mutex::new(
            window_commands::parse_launch_dir(),
        )))
        .manage(window_commands::DesktopBlurState::default())
        .manage(sleep::SleepInhibitorState::default())
        .manage(db::DbState(std::sync::Mutex::new(db_conn)))
        .manage(app_exit::ExitCoordinator::default())
        .setup(|_app| {
            #[cfg(target_os = "macos")]
            window_commands::setup_workspace_tray(_app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    app_exit::request(window.app_handle());
                }
            }
        })
        .invoke_handler(cmdspace_commands!())
        .build(tauri::generate_context!())
        .expect("error while building application");
    app.run(|app, event| {
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            if !app.state::<app_exit::ExitCoordinator>().is_exiting() {
                api.prevent_exit();
                app_exit::request(app);
            }
        }
    });
}
