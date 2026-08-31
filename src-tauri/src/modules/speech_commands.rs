use tauri::AppHandle;

#[tauri::command]
pub fn speech_supported_locales() -> Result<Vec<String>, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(super::macos::supported_locales())
    }

    #[cfg(target_os = "windows")]
    {
        super::windows::supported_locales()
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn speech_start(app: AppHandle, language: Option<String>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        super::macos::start(app, language)
    }

    #[cfg(target_os = "windows")]
    {
        super::windows::start(app, language)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (app, language);
        Err(
            "Native speech recognition is currently available on macOS and Windows only."
                .to_string(),
        )
    }
}

#[tauri::command]
pub fn speech_stop(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        super::macos::stop(app)
    }

    #[cfg(target_os = "windows")]
    {
        super::windows::stop(app)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = app;
        Err(
            "Native speech recognition is currently available on macOS and Windows only."
                .to_string(),
        )
    }
}
