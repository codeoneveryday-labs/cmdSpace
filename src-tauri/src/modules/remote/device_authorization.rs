use super::super::remote_devices::DeviceRegistry;
use std::sync::{Arc, Mutex};

pub(super) const REMOTE_WORKSPACE_ID: &str = "remote-runtime";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum RemoteDeviceAuthError {
    RegistryUnavailable,
    UnknownDevice,
    RevokedDevice,
    CapabilityDenied,
}

impl RemoteDeviceAuthError {
    #[allow(dead_code)]
    pub(super) fn code(self) -> &'static str {
        match self {
            Self::RegistryUnavailable => "REMOTE_DEVICE_REGISTRY_UNAVAILABLE",
            Self::UnknownDevice => "REMOTE_DEVICE_UNKNOWN",
            Self::RevokedDevice => "REMOTE_DEVICE_REVOKED",
            Self::CapabilityDenied => "REMOTE_DEVICE_CAPABILITY_DENIED",
        }
    }
}

impl std::fmt::Display for RemoteDeviceAuthError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::RegistryUnavailable => "remote device registry is unavailable",
            Self::UnknownDevice => "remote device is unknown",
            Self::RevokedDevice => "remote device has been revoked",
            Self::CapabilityDenied => "remote device capability is denied",
        })
    }
}

impl std::error::Error for RemoteDeviceAuthError {}

impl From<RemoteDeviceAuthError> for String {
    fn from(value: RemoteDeviceAuthError) -> Self {
        value.to_string()
    }
}

pub(super) fn require_view(
    devices: &Arc<Mutex<DeviceRegistry>>,
    device_id: &str,
    _message: &str,
) -> Result<(), RemoteDeviceAuthError> {
    let registry = devices
        .lock()
        .map_err(|_| RemoteDeviceAuthError::RegistryUnavailable)?;
    let device = registry
        .device(device_id)
        .ok_or(RemoteDeviceAuthError::UnknownDevice)?;
    if device.revoked_at.is_some() {
        return Err(RemoteDeviceAuthError::RevokedDevice);
    }
    if !device.capability.can_view {
        return Err(RemoteDeviceAuthError::CapabilityDenied);
    }
    Ok(())
}

pub(super) fn require_create(
    devices: &Arc<Mutex<DeviceRegistry>>,
    device_id: &str,
    _message: &str,
) -> Result<(), RemoteDeviceAuthError> {
    let registry = devices
        .lock()
        .map_err(|_| RemoteDeviceAuthError::RegistryUnavailable)?;
    let device = registry
        .device(device_id)
        .ok_or(RemoteDeviceAuthError::UnknownDevice)?;
    if device.revoked_at.is_some() {
        return Err(RemoteDeviceAuthError::RevokedDevice);
    }
    if !registry.can_create_terminal(device_id, REMOTE_WORKSPACE_ID) {
        return Err(RemoteDeviceAuthError::CapabilityDenied);
    }
    Ok(())
}

pub(super) fn session_allowed(
    devices: &Arc<Mutex<DeviceRegistry>>,
    device_id: &str,
    session_id: u64,
    check: fn(&DeviceRegistry, &str, &str, u64) -> bool,
) -> Result<bool, RemoteDeviceAuthError> {
    devices
        .lock()
        .map_err(|_| RemoteDeviceAuthError::RegistryUnavailable)
        .map(|devices| {
            let Some(device) = devices.device(device_id) else {
                return Err(RemoteDeviceAuthError::UnknownDevice);
            };
            if device.revoked_at.is_some() {
                return Err(RemoteDeviceAuthError::RevokedDevice);
            }
            Ok(check(&devices, device_id, REMOTE_WORKSPACE_ID, session_id))
        })?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_device_has_stable_authorization_code() {
        let devices = Arc::new(Mutex::new(DeviceRegistry::new_for_test([0_u8; 32])));
        let error = require_view(&devices, "missing", "ignored").expect_err("unknown device");

        assert_eq!(error.code(), "REMOTE_DEVICE_UNKNOWN");
        assert_eq!(error.to_string(), "remote device is unknown");
    }
}
