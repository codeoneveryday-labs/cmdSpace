//! Secret storage with platform-appropriate backends.
//!
//! - macOS: macOS Keychain (via `keyring` crate)
//! - Windows: Credential Manager (via `keyring` crate)
//! - Linux: a file in the app's local data dir, mode 0600. The default
//!   `keyring` backend on Linux is the Secret Service over D-Bus, which
//!   silently fails on systems without gnome-keyring/kwallet (and on the
//!   "login" collection not being created). For an open-source desktop
//!   app shipped via AppImage/deb/rpm, we cannot assume a keyring daemon
//!   exists. The file backend is the same approach Brave/Chromium fall
//!   back to in that scenario; user-only file permissions provide the
//!   isolation the secret-service collection would have otherwise.
//!
//! The frontend talks to `secrets_get`, `secrets_set`, `secrets_delete`,
//! and `secrets_get_all` — no platform branching in JS.
//!
//! All commands take `&AppHandle` so we can resolve the data directory
//! once via Tauri's path API.

use serde::ser::{Serialize, SerializeStruct, Serializer};
use std::collections::HashMap;
use std::sync::Mutex;

use tauri::AppHandle;

#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "linux")]
use std::path::PathBuf;
#[cfg(target_os = "linux")]
use tauri::Manager;

#[derive(Default)]
pub struct SecretsState {
    cache: Mutex<Option<HashMap<String, String>>>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum SecretsErrorKind {
    StateUnavailable,
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
    StorageLocation,
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
    StorageRead,
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
    StorageWrite,
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
    StorageSerialization,
    #[cfg_attr(target_os = "linux", allow(dead_code))]
    KeychainUnavailable,
    #[cfg_attr(target_os = "linux", allow(dead_code))]
    KeychainRead,
    #[cfg_attr(target_os = "linux", allow(dead_code))]
    KeychainWrite,
}

/// Safe secret-storage error returned at the Tauri boundary.
///
/// The key, service, account, secret value, platform path, and backend error
/// remain outside the serialized response.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SecretsError {
    kind: SecretsErrorKind,
}

impl SecretsError {
    const fn new(kind: SecretsErrorKind) -> Self {
        Self { kind }
    }

    fn code(self) -> &'static str {
        match self.kind {
            SecretsErrorKind::StateUnavailable => "SECRET_STATE_UNAVAILABLE",
            SecretsErrorKind::StorageLocation => "SECRET_STORAGE_LOCATION_UNAVAILABLE",
            SecretsErrorKind::StorageRead => "SECRET_STORAGE_READ_FAILED",
            SecretsErrorKind::StorageWrite => "SECRET_STORAGE_WRITE_FAILED",
            SecretsErrorKind::StorageSerialization => "SECRET_STORAGE_SERIALIZATION_FAILED",
            SecretsErrorKind::KeychainUnavailable => "SECRET_KEYCHAIN_UNAVAILABLE",
            SecretsErrorKind::KeychainRead => "SECRET_KEYCHAIN_READ_FAILED",
            SecretsErrorKind::KeychainWrite => "SECRET_KEYCHAIN_WRITE_FAILED",
        }
    }

    fn safe_message(self) -> &'static str {
        match self.kind {
            SecretsErrorKind::StateUnavailable => "secret storage state is unavailable",
            SecretsErrorKind::StorageLocation => "secret storage location is unavailable",
            SecretsErrorKind::StorageRead => "secret storage could not be read",
            SecretsErrorKind::StorageWrite => "secret storage could not be updated",
            SecretsErrorKind::StorageSerialization => "secret storage data is invalid",
            SecretsErrorKind::KeychainUnavailable => "secure storage is unavailable",
            SecretsErrorKind::KeychainRead => "secret could not be read from secure storage",
            SecretsErrorKind::KeychainWrite => "secret could not be updated in secure storage",
        }
    }
}

impl std::fmt::Display for SecretsError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.safe_message())
    }
}

impl std::error::Error for SecretsError {}

impl Serialize for SecretsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("IpcError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", self.safe_message())?;
        state.end()
    }
}

pub type SecretsResult<T> = std::result::Result<T, SecretsError>;

fn key(service: &str, account: &str) -> String {
    format!("{}::{}", service, account)
}

#[cfg(target_os = "linux")]
fn store_path(app: &AppHandle) -> SecretsResult<PathBuf> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|_| SecretsError::new(SecretsErrorKind::StorageLocation))?;
    fs::create_dir_all(&dir).map_err(|_| SecretsError::new(SecretsErrorKind::StorageLocation))?;
    Ok(dir.join("secrets.json"))
}

#[cfg(target_os = "linux")]
fn read_store(app: &AppHandle) -> SecretsResult<HashMap<String, String>> {
    let path = store_path(app)?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let bytes = fs::read(&path).map_err(|_| SecretsError::new(SecretsErrorKind::StorageRead))?;
    serde_json::from_slice::<HashMap<String, String>>(&bytes)
        .map_err(|_| SecretsError::new(SecretsErrorKind::StorageSerialization))
}

#[cfg(target_os = "linux")]
fn write_store(app: &AppHandle, map: &HashMap<String, String>) -> SecretsResult<()> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;

    let path = store_path(app)?;
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec(map)
        .map_err(|_| SecretsError::new(SecretsErrorKind::StorageSerialization))?;

    // 0600: only the owning user can read or write the secrets file.
    let mut f = fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(&tmp)
        .map_err(|_| SecretsError::new(SecretsErrorKind::StorageWrite))?;
    f.write_all(&bytes)
        .map_err(|_| SecretsError::new(SecretsErrorKind::StorageWrite))?;
    f.sync_all()
        .map_err(|_| SecretsError::new(SecretsErrorKind::StorageWrite))?;
    fs::rename(&tmp, &path).map_err(|_| SecretsError::new(SecretsErrorKind::StorageWrite))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn with_store<F, R>(app: &AppHandle, state: &SecretsState, f: F) -> SecretsResult<R>
where
    F: FnOnce(&mut HashMap<String, String>) -> R,
{
    let mut guard = state
        .cache
        .lock()
        .map_err(|_| SecretsError::new(SecretsErrorKind::StateUnavailable))?;
    if guard.is_none() {
        *guard = Some(read_store(app)?);
    }
    let map = guard
        .as_mut()
        .ok_or(SecretsError::new(SecretsErrorKind::StateUnavailable))?;
    Ok(f(map))
}

#[cfg(not(target_os = "linux"))]
fn entry(service: &str, account: &str) -> SecretsResult<keyring::Entry> {
    keyring::Entry::new(service, account)
        .map_err(|_| SecretsError::new(SecretsErrorKind::KeychainUnavailable))
}

#[tauri::command]
pub async fn secrets_get(
    app: AppHandle,
    state: tauri::State<'_, SecretsState>,
    service: String,
    account: String,
) -> SecretsResult<Option<String>> {
    #[cfg(target_os = "linux")]
    {
        let _ = state; // capture
        let key = key(&service, &account);
        with_store(&app, &state, |m| m.get(&key).cloned())
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = app;
        let cache_key = key(&service, &account);
        if let Some(value) = state
            .cache
            .lock()
            .map_err(|_| SecretsError::new(SecretsErrorKind::StateUnavailable))?
            .as_ref()
            .and_then(|cache| cache.get(&cache_key).cloned())
        {
            return Ok(Some(value));
        }
        let e = entry(&service, &account)?;
        match e.get_password() {
            Ok(v) => {
                let mut guard = state
                    .cache
                    .lock()
                    .map_err(|_| SecretsError::new(SecretsErrorKind::StateUnavailable))?;
                guard
                    .get_or_insert_with(HashMap::new)
                    .insert(cache_key, v.clone());
                Ok(Some(v))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(SecretsError::new(SecretsErrorKind::KeychainRead)),
        }
    }
}

#[tauri::command]
pub async fn secrets_set(
    app: AppHandle,
    state: tauri::State<'_, SecretsState>,
    service: String,
    account: String,
    password: String,
) -> SecretsResult<()> {
    #[cfg(target_os = "linux")]
    {
        let key = key(&service, &account);
        with_store(&app, &state, |m| {
            m.insert(key, password);
        })?;
        let snapshot = {
            let guard = state
                .cache
                .lock()
                .map_err(|_| SecretsError::new(SecretsErrorKind::StateUnavailable))?;
            guard.as_ref().cloned().unwrap_or_default()
        };
        write_store(&app, &snapshot)
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = app;
        let e = entry(&service, &account)?;
        e.set_password(&password)
            .map_err(|_| SecretsError::new(SecretsErrorKind::KeychainWrite))?;
        state
            .cache
            .lock()
            .map_err(|_| SecretsError::new(SecretsErrorKind::StateUnavailable))?
            .get_or_insert_with(HashMap::new)
            .insert(key(&service, &account), password);
        Ok(())
    }
}

#[tauri::command]
pub async fn secrets_delete(
    app: AppHandle,
    state: tauri::State<'_, SecretsState>,
    service: String,
    account: String,
) -> SecretsResult<()> {
    #[cfg(target_os = "linux")]
    {
        let key = key(&service, &account);
        with_store(&app, &state, |m| {
            m.remove(&key);
        })?;
        let snapshot = {
            let guard = state
                .cache
                .lock()
                .map_err(|_| SecretsError::new(SecretsErrorKind::StateUnavailable))?;
            guard.as_ref().cloned().unwrap_or_default()
        };
        write_store(&app, &snapshot)
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = app;
        let e = entry(&service, &account)?;
        match e.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {
                if let Some(cache) = state
                    .cache
                    .lock()
                    .map_err(|_| SecretsError::new(SecretsErrorKind::StateUnavailable))?
                    .as_mut()
                {
                    cache.remove(&key(&service, &account));
                }
                Ok(())
            }
            Err(_) => Err(SecretsError::new(SecretsErrorKind::KeychainWrite)),
        }
    }
}

/// Batch read — single IPC roundtrip for the cold-boot fan-out.
#[tauri::command]
pub async fn secrets_get_all(
    app: AppHandle,
    state: tauri::State<'_, SecretsState>,
    service: String,
    accounts: Vec<String>,
) -> SecretsResult<Vec<Option<String>>> {
    #[cfg(target_os = "linux")]
    {
        with_store(&app, &state, |m| {
            accounts
                .iter()
                .map(|a| m.get(&key(&service, a)).cloned())
                .collect()
        })
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = app;
        Ok(accounts
            .into_iter()
            .map(|a| {
                let cache_key = key(&service, &a);
                if let Some(value) = state.cache.lock().ok().and_then(|guard| {
                    guard
                        .as_ref()
                        .and_then(|cache| cache.get(&cache_key).cloned())
                }) {
                    return Some(value);
                }
                let value = keyring::Entry::new(&service, &a)
                    .ok()
                    .and_then(|e| e.get_password().ok());
                if let Some(value) = &value {
                    if let Ok(mut guard) = state.cache.lock() {
                        guard
                            .get_or_insert_with(HashMap::new)
                            .insert(cache_key, value.clone());
                    }
                }
                value
            })
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secrets_errors_serialize_stable_codes_without_backend_details() {
        let value = serde_json::to_value(SecretsError::new(SecretsErrorKind::KeychainRead))
            .expect("serialize secrets error");

        assert_eq!(value["code"], "SECRET_KEYCHAIN_READ_FAILED");
        assert_eq!(
            value["message"],
            "secret could not be read from secure storage"
        );
        let serialized = value.to_string();
        assert!(!serialized.contains("service"));
        assert!(!serialized.contains("account"));
        assert!(!serialized.contains("password"));
    }

    #[test]
    fn secrets_errors_distinguish_state_storage_and_keychain_failures() {
        let cases = [
            (
                SecretsError::new(SecretsErrorKind::StateUnavailable),
                "SECRET_STATE_UNAVAILABLE",
            ),
            (
                SecretsError::new(SecretsErrorKind::StorageLocation),
                "SECRET_STORAGE_LOCATION_UNAVAILABLE",
            ),
            (
                SecretsError::new(SecretsErrorKind::StorageRead),
                "SECRET_STORAGE_READ_FAILED",
            ),
            (
                SecretsError::new(SecretsErrorKind::StorageWrite),
                "SECRET_STORAGE_WRITE_FAILED",
            ),
            (
                SecretsError::new(SecretsErrorKind::StorageSerialization),
                "SECRET_STORAGE_SERIALIZATION_FAILED",
            ),
            (
                SecretsError::new(SecretsErrorKind::KeychainUnavailable),
                "SECRET_KEYCHAIN_UNAVAILABLE",
            ),
            (
                SecretsError::new(SecretsErrorKind::KeychainWrite),
                "SECRET_KEYCHAIN_WRITE_FAILED",
            ),
        ];

        for (error, code) in cases {
            assert_eq!(
                serde_json::to_value(error).expect("serialize secrets error")["code"],
                code
            );
        }
    }
}
