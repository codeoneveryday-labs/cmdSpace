use tauri::{Emitter, Manager};
#[cfg(target_os = "macos")]
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    PhysicalPosition, WebviewUrl, WebviewWindowBuilder,
};

pub(crate) const WORKSPACE_SWITCHER_LABEL: &str = "tray";

#[cfg(target_os = "macos")]
pub(crate) const WORKSPACE_TRAY_ID: &str = "cmdspace-workspaces";
#[cfg(target_os = "macos")]
pub(crate) const WORKSPACE_SWITCHER_WIDTH: f64 = 420.0;
#[cfg(target_os = "macos")]
pub(crate) const WORKSPACE_SWITCHER_HEIGHT: f64 = 520.0;

#[cfg(target_os = "macos")]
#[derive(Clone, Copy)]
pub(crate) struct WorkspaceSwitcherRect {
    pub(crate) left: f64,
    pub(crate) top: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
}

#[cfg(target_os = "macos")]
pub(crate) fn workspace_switcher_position(
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
pub(crate) fn show_workspace_switcher(
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
pub(crate) fn setup_workspace_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
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
pub(crate) fn hide_workspace_switcher_impl(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WORKSPACE_SWITCHER_LABEL) {
        window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn hide_workspace_switcher_impl() -> Result<(), String> {
    Ok(())
}

pub(crate) fn open_workspace_from_tray_impl(
    app: tauri::AppHandle,
    workspace_id: String,
) -> Result<(), String> {
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
