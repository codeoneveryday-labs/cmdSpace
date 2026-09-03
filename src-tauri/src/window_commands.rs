//! Compatibility facade for native window-surface commands.
//!
//! Command registration remains at `window_commands::*`; each implementation
//! concern lives in a focused platform seam below.

#[path = "window_desktop_blur.rs"]
mod desktop_blur;
#[path = "window_launch.rs"]
mod launch;
#[path = "window_settings.rs"]
mod settings;
#[path = "window_webview.rs"]
mod webview_corner_radius;
#[path = "window_workspace_switcher.rs"]
mod workspace_switcher;

use tauri::State;

#[cfg(all(test, target_os = "macos"))]
pub(crate) use desktop_blur::desktop_blur_collection_behavior;
pub(crate) use desktop_blur::DesktopBlurState;

pub(crate) use launch::{parse_launch_dir, LaunchDir};
#[cfg(target_os = "macos")]
pub(crate) use workspace_switcher::setup_workspace_tray;
#[cfg(all(test, target_os = "macos"))]
pub(crate) use workspace_switcher::{workspace_switcher_position, WorkspaceSwitcherRect};

#[tauri::command]
pub(crate) fn get_launch_dir(state: State<'_, LaunchDir>) -> Option<String> {
    launch::get_launch_dir(state)
}

#[tauri::command]
pub(crate) async fn open_settings_window(
    app: tauri::AppHandle,
    tab: Option<String>,
) -> Result<(), String> {
    settings::open_settings_window_impl(app, tab).await
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub(crate) fn hide_workspace_switcher(app: tauri::AppHandle) -> Result<(), String> {
    workspace_switcher::hide_workspace_switcher_impl(app)
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub(crate) fn hide_workspace_switcher() -> Result<(), String> {
    workspace_switcher::hide_workspace_switcher_impl()
}

#[tauri::command]
pub(crate) fn open_workspace_from_tray(
    app: tauri::AppHandle,
    workspace_id: String,
    pane_index: Option<usize>,
) -> Result<(), String> {
    workspace_switcher::open_workspace_from_tray_impl(app, workspace_id, pane_index)
}

#[tauri::command]
pub(crate) async fn set_desktop_blur(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopBlurState>,
    enabled: bool,
) -> Result<(), String> {
    desktop_blur::set_desktop_blur_impl(app, state, enabled).await
}

#[tauri::command]
pub(crate) fn set_webview_corner_radius(
    app: tauri::AppHandle,
    label: String,
    radius: f64,
) -> Result<(), String> {
    webview_corner_radius::set_webview_corner_radius_impl(app, label, radius)
}
