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
    use super::super::super::remote_devices::{DeviceCapability, TerminalPolicy};
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    #[test]
    fn unknown_device_has_stable_authorization_code() {
        let devices = Arc::new(Mutex::new(DeviceRegistry::new_for_test([0_u8; 32])));
        let error = require_view(&devices, "missing", "ignored").expect_err("unknown device");

        assert_eq!(error.code(), "REMOTE_DEVICE_UNKNOWN");
        assert_eq!(error.to_string(), "remote device is unknown");
    }

    #[test]
    fn view_only_device_cannot_create_remote_terminals() {
        let signing_key = SigningKey::from_bytes(&[3_u8; 32]);
        let mut registry = DeviceRegistry::new_for_test([4_u8; 32]);
        let grant = registry.issue_grant(
            "viewer",
            DeviceCapability {
                workspace_id: REMOTE_WORKSPACE_ID.to_string(),
                terminal_policy: TerminalPolicy::AnyOwnedSession,
                can_view: true,
                can_input: false,
                can_create_terminal: false,
                can_close_terminal: false,
            },
            10,
            60,
        );
        let device = registry
            .consume_grant_with_proof(
                &grant.secret,
                signing_key.verifying_key().to_bytes(),
                signing_key.sign(grant.secret.as_bytes()).to_bytes(),
                10,
            )
            .expect("pair view-only device");
        let devices = Arc::new(Mutex::new(registry));

        require_view(&devices, &device.id, "ignored").expect("view capability");
        let error = require_create(&devices, &device.id, "ignored")
            .expect_err("view-only device must not create");

        assert_eq!(error.code(), "REMOTE_DEVICE_CAPABILITY_DENIED");
        assert_eq!(error.to_string(), "remote device capability is denied");
    }
}
