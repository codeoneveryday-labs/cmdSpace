use std::sync::Mutex;

#[derive(Default)]
pub struct SleepInhibitorState(pub Mutex<SleepInhibitor>);

#[derive(Default)]
pub struct SleepInhibitor {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    inhibitor_child: Option<std::process::Child>,
    enabled: bool,
}

impl SleepInhibitor {
    pub fn set_enabled(&mut self, enabled: bool) -> Result<(), String> {
        if self.enabled == enabled {
            return Ok(());
        }

        if enabled {
            self.start()?;
        } else {
            self.stop();
        }
        self.enabled = enabled;
        Ok(())
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    #[cfg(target_os = "macos")]
    fn start(&mut self) -> Result<(), String> {
        self.stop();
        let pid = std::process::id().to_string();
        let child = std::process::Command::new("caffeinate")
            .arg("-w")
            .arg(pid)
            .arg("-d")
            .arg("-i")
            .arg("-m")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn caffeinate: {e}"))?;
        self.inhibitor_child = Some(child);
        Ok(())
    }

    #[cfg(target_os = "linux")]
    fn start(&mut self) -> Result<(), String> {
        self.stop();
        // Hold a systemd inhibitor lock for as long as this child lives.
        // `sleep infinity` never exits on its own; killing the child on
        // stop()/drop releases the lock. Mirrors the caffeinate pattern.
        let child = std::process::Command::new("systemd-inhibit")
            .arg("--what=sleep:idle")
            .arg("--mode=block")
            .arg("--who=cmdSpace")
            .arg("--why=Prevent the computer from sleeping while the app is running")
            .arg("sleep")
            .arg("infinity")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn systemd-inhibit: {e}"))?;
        self.inhibitor_child = Some(child);
        Ok(())
    }

    #[cfg(target_os = "windows")]
    fn start(&mut self) -> Result<(), String> {
        unsafe {
            windows_sys::Win32::System::Power::SetThreadExecutionState(
                windows_sys::Win32::System::Power::ES_CONTINUOUS
                    | windows_sys::Win32::System::Power::ES_SYSTEM_REQUIRED
                    | windows_sys::Win32::System::Power::ES_DISPLAY_REQUIRED,
            );
        }
        Ok(())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    fn start(&mut self) -> Result<(), String> {
        Ok(())
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    fn stop(&mut self) {
        if let Some(mut child) = self.inhibitor_child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    #[cfg(target_os = "windows")]
    fn stop(&mut self) {
        unsafe {
            windows_sys::Win32::System::Power::SetThreadExecutionState(
                windows_sys::Win32::System::Power::ES_CONTINUOUS,
            );
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    fn stop(&mut self) {}
}

impl Drop for SleepInhibitor {
    fn drop(&mut self) {
        self.stop();
    }
}

#[tauri::command]
pub fn set_prevent_sleep(
    state: tauri::State<'_, SleepInhibitorState>,
    enabled: bool,
) -> Result<(), String> {
    let mut inhibitor = state
        .0
        .lock()
        .map_err(|_| "Sleep inhibitor mutex poisoned".to_string())?;
    inhibitor.set_enabled(enabled)
}

#[tauri::command]
pub fn get_prevent_sleep(
    state: tauri::State<'_, SleepInhibitorState>,
) -> Result<bool, String> {
    let inhibitor = state
        .0
        .lock()
        .map_err(|_| "Sleep inhibitor mutex poisoned".to_string())?;
    Ok(inhibitor.is_enabled())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sleep_inhibitor_toggles_state() {
        let mut inhibitor = SleepInhibitor::default();
        assert!(!inhibitor.is_enabled());

        assert!(inhibitor.set_enabled(true).is_ok());
        assert!(inhibitor.is_enabled());

        assert!(inhibitor.set_enabled(false).is_ok());
        assert!(!inhibitor.is_enabled());
    }
}
