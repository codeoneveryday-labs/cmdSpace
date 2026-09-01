use super::super::remote_devices::DeviceRegistry;
use std::sync::{Arc, Mutex};

pub(super) const REMOTE_WORKSPACE_ID: &str = "remote-runtime";

pub(super) fn require_view(
    devices: &Arc<Mutex<DeviceRegistry>>,
    device_id: &str,
    message: &str,
) -> Result<(), String> {
    let allowed = devices
        .lock()
        .map_err(|_| "remote device registry poisoned".to_string())?
        .device(device_id)
        .is_some_and(|device| device.revoked_at.is_none() && device.capability.can_view);
    if allowed {
        Ok(())
    } else {
        Err(message.to_string())
    }
}

pub(super) fn require_create(
    devices: &Arc<Mutex<DeviceRegistry>>,
    device_id: &str,
    message: &str,
) -> Result<(), String> {
    let allowed = devices
        .lock()
        .map_err(|_| "remote device registry poisoned".to_string())?
        .can_create_terminal(device_id, REMOTE_WORKSPACE_ID);
    if allowed {
        Ok(())
    } else {
        Err(message.to_string())
    }
}

pub(super) fn session_allowed(
    devices: &Arc<Mutex<DeviceRegistry>>,
    device_id: &str,
    session_id: u64,
    check: fn(&DeviceRegistry, &str, &str, u64) -> bool,
) -> Result<bool, String> {
    devices
        .lock()
        .map_err(|_| "remote device registry poisoned".to_string())
        .map(|devices| check(&devices, device_id, REMOTE_WORKSPACE_ID, session_id))
}
