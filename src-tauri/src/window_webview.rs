#[cfg(target_os = "macos")]
pub(crate) fn set_webview_corner_radius_impl(
    app: tauri::AppHandle,
    label: String,
    radius: f64,
) -> Result<(), String> {
    use objc2::{msg_send, runtime::AnyObject};
    use tauri::Manager;

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
pub(crate) fn set_webview_corner_radius_impl(
    _app: tauri::AppHandle,
    _label: String,
    _radius: f64,
) -> Result<(), String> {
    Ok(())
}
