#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::State;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg(any(target_os = "macos", target_os = "windows"))]
#[derive(Clone, Default)]
pub(crate) struct DesktopBlurState {
    transition: Arc<AtomicU64>,
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
#[derive(Default)]
pub(crate) struct DesktopBlurState {
    // Keep this non-unit on unsupported platforms so managed-state construction
    // stays lint-clean under the cross-platform build.
    _unsupported: (),
}

#[cfg(target_os = "macos")]
fn set_native_window_alpha<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
    alpha: f64,
) -> Result<(), String> {
    let ns_window = window.ns_window().map_err(|error| error.to_string())? as usize;
    window
        .run_on_main_thread(move || unsafe {
            let ns_window = &*(ns_window as *mut objc2_app_kit::NSWindow);
            ns_window.setAlphaValue(alpha);
        })
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
pub(crate) fn desktop_blur_collection_behavior() -> objc2_app_kit::NSWindowCollectionBehavior {
    objc2_app_kit::NSWindowCollectionBehavior::CanJoinAllSpaces
        | objc2_app_kit::NSWindowCollectionBehavior::CanJoinAllApplications
        | objc2_app_kit::NSWindowCollectionBehavior::Stationary
        | objc2_app_kit::NSWindowCollectionBehavior::FullScreenAuxiliary
}

#[cfg(target_os = "macos")]
fn configure_desktop_blur_window<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Result<(), String> {
    let ns_window = window.ns_window().map_err(|error| error.to_string())? as usize;
    window
        .run_on_main_thread(move || unsafe {
            let ns_window = &*(ns_window as *mut objc2_app_kit::NSWindow);
            // Keep the overlay at the same level as the primary window so
            // Stage Manager does not replace cmdSpace with the previous app.
            ns_window.setLevel(objc2_app_kit::NSNormalWindowLevel);
            ns_window.setHidesOnDeactivate(false);
            ns_window.setCollectionBehavior(desktop_blur_collection_behavior());
        })
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
fn order_native_window_below<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
    relative_to: &tauri::WebviewWindow<R>,
) -> Result<(), String> {
    let ns_window = window.ns_window().map_err(|error| error.to_string())? as usize;
    let relative_to = relative_to.ns_window().map_err(|error| error.to_string())? as usize;
    window
        .run_on_main_thread(move || unsafe {
            let ns_window = &*(ns_window as *mut objc2_app_kit::NSWindow);
            let relative_to = &*(relative_to as *mut objc2_app_kit::NSWindow);
            ns_window.orderWindow_relativeTo(
                objc2_app_kit::NSWindowOrderingMode::Below,
                relative_to.windowNumber(),
            );
        })
        .map_err(|error| error.to_string())
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

    let hwnd = window.hwnd().map_err(|error| error.to_string())?.0 as usize;
    window
        .run_on_main_thread(move || unsafe {
            let hwnd = hwnd as _;
            let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            if style & WS_EX_LAYERED as isize == 0 {
                let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED as isize);
            }
            let _ = SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA);
        })
        .map_err(|error| error.to_string())
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

    let overlay = window.hwnd().map_err(|error| error.to_string())?.0 as usize;
    let main = relative_to.hwnd().map_err(|error| error.to_string())?.0 as usize;
    window
        .run_on_main_thread(move || unsafe {
            let overlay = overlay as _;
            let main = main as _;
            let flags =
                SWP_ASYNCWINDOWPOS | SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOOWNERZORDER | SWP_NOSIZE;
            let _ = SetWindowPos(overlay, HWND_TOP, 0, 0, 0, 0, flags);
            let _ = SetWindowPos(main, overlay, 0, 0, 0, 0, flags);
        })
        .map_err(|error| error.to_string())
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
        .map_err(|error| error.to_string())?
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
                .map_err(|error| error.to_string())?;
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
        window
            .set_fullscreen(false)
            .map_err(|error| error.to_string())?;
        window
            .set_position(position)
            .map_err(|error| error.to_string())?;
        window.set_size(size).map_err(|error| error.to_string())?;
        window
            .set_focusable(false)
            .map_err(|error| error.to_string())?;
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
        .map_err(|error| error.to_string())?
    };

    window
        .set_ignore_cursor_events(true)
        .map_err(|error| error.to_string())?;
    window
        .set_focusable(false)
        .map_err(|error| error.to_string())?;
    window
        .set_background_color(None)
        .map_err(|error| error.to_string())?;
    set_windows_window_alpha(&window, 0)?;
    window
        .set_effects(
            EffectsBuilder::new()
                .effect(Effect::Acrylic)
                .state(EffectState::Active)
                .build(),
        )
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    order_windows_overlay_below(&window, &main_window)?;
    window
        .emit("cmdspace:desktop-blur-transition", "on")
        .map_err(|error| error.to_string())?;

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

pub(crate) async fn set_desktop_blur_impl(
    app: tauri::AppHandle,
    state: State<'_, DesktopBlurState>,
    enabled: bool,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return set_macos_desktop_blur(app, state, enabled).await;
    }

    #[cfg(target_os = "windows")]
    {
        return set_windows_desktop_blur(app, state, enabled);
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (app, state, enabled);
        Ok(())
    }
}

#[cfg(target_os = "macos")]
async fn set_macos_desktop_blur(
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
        .map_err(|error| error.to_string())?
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
                .map_err(|error| error.to_string())?;
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
        window
            .set_fullscreen(false)
            .map_err(|error| error.to_string())?;
        window
            .set_position(position)
            .map_err(|error| error.to_string())?;
        window.set_size(size).map_err(|error| error.to_string())?;
        window
            .set_visible_on_all_workspaces(true)
            .map_err(|error| error.to_string())?;
        window
            .set_focusable(false)
            .map_err(|error| error.to_string())?;
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
        .visible_on_all_workspaces(true)
        .focused(false)
        .focusable(false)
        .skip_taskbar(true)
        .shadow(false)
        .resizable(false)
        .visible(false)
        .build()
        .map_err(|error| error.to_string())?
    };

    window
        .set_ignore_cursor_events(true)
        .map_err(|error| error.to_string())?;
    window
        .set_focusable(false)
        .map_err(|error| error.to_string())?;
    configure_desktop_blur_window(&window)?;
    window
        .set_background_color(None)
        .map_err(|error| error.to_string())?;
    set_native_window_alpha(&window, 0.0)?;
    window
        .set_effects(
            EffectsBuilder::new()
                .effect(Effect::UnderWindowBackground)
                .state(EffectState::Active)
                .radius(0.0)
                .build(),
        )
        .map_err(|error| error.to_string())?;
    // Order behind the primary window without activating either surface.
    order_native_window_below(&window, &main_window)?;
    window
        .emit("cmdspace:desktop-blur-transition", "on")
        .map_err(|error| error.to_string())?;

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
