use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use getrandom::fill;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub enum TerminalPolicy {
    AnyOwnedSession,
    ExplicitSessionIds(Vec<u64>),
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub struct DeviceCapability {
    pub workspace_id: String,
    pub terminal_policy: TerminalPolicy,
    pub can_view: bool,
    pub can_input: bool,
    pub can_create_terminal: bool,
    pub can_close_terminal: bool,
}

impl DeviceCapability {
    #[allow(dead_code)]
    pub fn workspace_terminal_controller(workspace_id: &str, session_id: u64) -> Self {
        Self {
            workspace_id: workspace_id.to_owned(),
            terminal_policy: TerminalPolicy::ExplicitSessionIds(vec![session_id]),
            can_view: true,
            can_input: true,
            can_create_terminal: false,
            can_close_terminal: false,
        }
    }

    #[allow(dead_code)]
    pub fn workspace_terminal_viewer(workspace_id: &str) -> Self {
        Self {
            workspace_id: workspace_id.to_owned(),
            terminal_policy: TerminalPolicy::AnyOwnedSession,
            can_view: true,
            can_input: false,
            can_create_terminal: false,
            can_close_terminal: false,
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub struct PairedDevice {
    pub id: String,
    pub display_name: String,
    pub public_key: [u8; 32],
    pub capability: DeviceCapability,
    pub revoked_at: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PairingGrant {
    pub secret: String,
    pub expires_at: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PairingGrantError {
    Unknown,
    Expired,
    Consumed,
    InvalidProof,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DeviceRegistryError {
    UnknownDevice,
    Storage(String),
}

struct PendingGrant {
    secret_hash: [u8; 32],
    display_name: String,
    capability: DeviceCapability,
    expires_at: u64,
    consumed: bool,
}

pub struct DeviceRegistry {
    grant_key: [u8; 32],
    grants: Vec<PendingGrant>,
    devices: Vec<PairedDevice>,
    path: Option<PathBuf>,
}

#[derive(Deserialize, Serialize)]
struct StoredRegistry {
    devices: Vec<PairedDevice>,
}

impl DeviceRegistry {
    #[cfg(test)]
    pub fn new_for_test(grant_key: [u8; 32]) -> Self {
        Self::new(grant_key)
    }

    #[cfg(test)]
    fn new(grant_key: [u8; 32]) -> Self {
        Self {
            grant_key,
            grants: Vec::new(),
            devices: Vec::new(),
            path: None,
        }
    }

    pub fn load_or_create(path: &Path, grant_key: [u8; 32]) -> Result<Self, DeviceRegistryError> {
        let devices = if path.exists() {
            let text = fs::read_to_string(path)
                .map_err(|error| DeviceRegistryError::Storage(error.to_string()))?;
            serde_json::from_str::<StoredRegistry>(&text)
                .map_err(|error| DeviceRegistryError::Storage(error.to_string()))?
                .devices
                .into_iter()
                .filter(|device| device.revoked_at.is_none())
                .collect()
        } else {
            Vec::new()
        };
        Ok(Self {
            grant_key,
            grants: Vec::new(),
            devices,
            path: Some(path.to_path_buf()),
        })
    }

    pub fn issue_grant(
        &mut self,
        display_name: &str,
        capability: DeviceCapability,
        now: u64,
        ttl_seconds: u64,
    ) -> PairingGrant {
        let mut random = [0_u8; 32];
        fill(&mut random).expect("operating system random source must be available");
        let secret = hex_encode(&random);
        let secret_hash = self.grant_hash(&secret);
        let expires_at = now.saturating_add(ttl_seconds);
        self.grants.push(PendingGrant {
            secret_hash,
            display_name: display_name.to_owned(),
            capability,
            expires_at,
            consumed: false,
        });
        PairingGrant { secret, expires_at }
    }

    pub fn default_native_capability() -> DeviceCapability {
        DeviceCapability {
            workspace_id: "remote-runtime".to_owned(),
            terminal_policy: TerminalPolicy::AnyOwnedSession,
            can_view: true,
            can_input: true,
            can_create_terminal: true,
            can_close_terminal: true,
        }
    }

    pub fn consume_grant_with_proof(
        &mut self,
        secret: &str,
        public_key: [u8; 32],
        signature: [u8; 64],
        now: u64,
    ) -> Result<PairedDevice, PairingGrantError> {
        let secret_hash = self.grant_hash(secret);
        let Some(grant) = self
            .grants
            .iter_mut()
            .find(|grant| grant.secret_hash == secret_hash)
        else {
            return Err(PairingGrantError::Unknown);
        };
        if grant.consumed {
            return Err(PairingGrantError::Consumed);
        }
        if now > grant.expires_at {
            return Err(PairingGrantError::Expired);
        }
        let verifying_key =
            VerifyingKey::from_bytes(&public_key).map_err(|_| PairingGrantError::InvalidProof)?;
        let signature = Signature::from_bytes(&signature);
        verifying_key
            .verify(secret.as_bytes(), &signature)
            .map_err(|_| PairingGrantError::InvalidProof)?;

        grant.consumed = true;
        let device = PairedDevice {
            id: device_id(&public_key),
            display_name: grant.display_name.clone(),
            public_key,
            capability: grant.capability.clone(),
            revoked_at: None,
        };
        if let Some(existing) = self
            .devices
            .iter_mut()
            .find(|existing| existing.id == device.id)
        {
            *existing = device.clone();
        } else {
            self.devices.push(device.clone());
        }
        Ok(device)
    }

    pub fn devices(&self) -> &[PairedDevice] {
        &self.devices
    }

    pub fn device(&self, device_id: &str) -> Option<&PairedDevice> {
        self.devices.iter().find(|device| device.id == device_id)
    }

    pub fn revoke(&mut self, device_id: &str, now: u64) -> Result<(), DeviceRegistryError> {
        let _ = now;
        let before = self.devices.len();
        self.devices.retain(|device| device.id != device_id);
        if self.devices.len() == before {
            return Err(DeviceRegistryError::UnknownDevice);
        }
        Ok(())
    }

    pub fn verify_device_proof(
        &self,
        device_id: &str,
        message: &[u8],
        signature: [u8; 64],
    ) -> bool {
        self.device(device_id).is_some_and(|device| {
            device.revoked_at.is_none()
                && VerifyingKey::from_bytes(&device.public_key)
                    .map(|key| {
                        key.verify(message, &Signature::from_bytes(&signature))
                            .is_ok()
                    })
                    .unwrap_or(false)
        })
    }

    pub fn can_input(&self, device_id: &str, workspace_id: &str, session_id: u64) -> bool {
        self.can_access_session(device_id, workspace_id, session_id, |capability| {
            capability.can_input
        })
    }

    pub fn can_view(&self, device_id: &str, workspace_id: &str, session_id: u64) -> bool {
        self.can_access_session(device_id, workspace_id, session_id, |capability| {
            capability.can_view
        })
    }

    pub fn can_create_terminal(&self, device_id: &str, workspace_id: &str) -> bool {
        self.device(device_id).is_some_and(|device| {
            device.revoked_at.is_none()
                && device.capability.workspace_id == workspace_id
                && device.capability.can_create_terminal
        })
    }

    pub fn can_close_terminal(&self, device_id: &str, workspace_id: &str, session_id: u64) -> bool {
        self.can_access_session(device_id, workspace_id, session_id, |capability| {
            capability.can_close_terminal
        })
    }

    pub fn save(&self) -> Result<(), DeviceRegistryError> {
        let Some(path) = self.path.as_ref() else {
            return Ok(());
        };
        let stored = serde_json::to_string(&StoredRegistry {
            devices: self.devices.clone(),
        })
        .map_err(|error| DeviceRegistryError::Storage(error.to_string()))?;
        let parent = path.parent().ok_or_else(|| {
            DeviceRegistryError::Storage("device registry path has no parent".to_string())
        })?;
        fs::create_dir_all(parent)
            .map_err(|error| DeviceRegistryError::Storage(error.to_string()))?;
        let temporary = path.with_extension("tmp");
        let mut options = fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&temporary)
            .map_err(|error| DeviceRegistryError::Storage(error.to_string()))?;
        use std::io::Write;
        file.write_all(stored.as_bytes())
            .and_then(|()| file.sync_all())
            .map_err(|error| DeviceRegistryError::Storage(error.to_string()))?;
        fs::rename(temporary, path).map_err(|error| DeviceRegistryError::Storage(error.to_string()))
    }

    fn grant_hash(&self, secret: &str) -> [u8; 32] {
        let mut digest = Sha256::new();
        digest.update(self.grant_key);
        digest.update(secret.as_bytes());
        digest.finalize().into()
    }

    fn can_access_session(
        &self,
        device_id: &str,
        workspace_id: &str,
        session_id: u64,
        allows: impl FnOnce(&DeviceCapability) -> bool,
    ) -> bool {
        self.device(device_id).is_some_and(|device| {
            device.revoked_at.is_none()
                && device.capability.workspace_id == workspace_id
                && session_is_allowed(&device.capability.terminal_policy, session_id)
                && allows(&device.capability)
        })
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

pub(crate) fn device_id(public_key: &[u8; 32]) -> String {
    let digest: [u8; 32] = Sha256::digest(public_key).into();
    hex_encode(&digest[..16])
}

fn session_is_allowed(policy: &TerminalPolicy, session_id: u64) -> bool {
    match policy {
        TerminalPolicy::AnyOwnedSession => true,
        TerminalPolicy::ExplicitSessionIds(ids) => ids.contains(&session_id),
    }
}
