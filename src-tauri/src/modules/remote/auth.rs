use super::super::remote_auth::{now_unix_seconds, RemoteAuth, RemoteAuthError};
use super::http::request_body;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use std::{
    fs,
    io::Write,
    net::IpAddr,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

pub(super) fn device_challenge() -> String {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes).expect("operating system random source must be available");
    URL_SAFE_NO_PAD.encode(bytes)
}

pub(super) fn authenticate_remote_websocket(
    auth: &Arc<Mutex<RemoteAuth>>,
    client_ip: IpAddr,
    token: &str,
) -> Result<u64, String> {
    let now = now_unix_seconds();
    let mut auth = auth
        .lock()
        .map_err(|_| "remote authentication state poisoned".to_string())?;
    if !auth.allow_auth_attempt(client_ip, now) {
        return Err(RemoteAuthError::RateLimited.to_string());
    }
    match auth.verify_session_token(token, now) {
        Ok(_) => Ok(auth.session_generation()),
        Err(error) => {
            auth.record_failed_auth_attempt(client_ip, now);
            Err(error.to_string())
        }
    }
}

pub(super) fn remote_password_setup_response(
    request: &[u8],
    auth: &Arc<Mutex<RemoteAuth>>,
    client_ip: IpAddr,
    password_store_path: &Path,
) -> Result<String, String> {
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Input {
        secret: String,
        password: String,
        device: Option<String>,
    }

    let input: Input =
        serde_json::from_str(request_body(request)).map_err(|error| error.to_string())?;
    let now = now_unix_seconds();
    let mut auth = auth
        .lock()
        .map_err(|_| "remote authentication state poisoned".to_string())?;
    if !auth.allow_auth_attempt(client_ip, now) {
        return Err(RemoteAuthError::RateLimited.to_string());
    }
    let token = match auth.setup_password(&input.secret, &input.password, now) {
        Ok(()) => {
            let verifier = auth
                .password_verifier()
                .ok_or_else(|| "password verifier was not created".to_string())?;
            store_remote_password_verifier(password_store_path, verifier)?;
            auth.authenticate_password(
                &input.password,
                input.device.as_deref().unwrap_or("remote-browser"),
                now,
            )
        }
        Err(error) => {
            auth.record_failed_auth_attempt(client_ip, now);
            return Err(error.to_string());
        }
    }
    .map_err(|error| error.to_string())?;
    serde_json::to_string(&serde_json::json!({
        "token": token,
        "expiresIn": 24 * 60 * 60,
    }))
    .map_err(|error| error.to_string())
}

pub(super) fn remote_password_login_response(
    request: &[u8],
    auth: &Arc<Mutex<RemoteAuth>>,
    client_ip: IpAddr,
) -> Result<String, String> {
    #[derive(serde::Deserialize)]
    struct Input {
        password: String,
        device: Option<String>,
    }

    let input: Input =
        serde_json::from_str(request_body(request)).map_err(|error| error.to_string())?;
    let now = now_unix_seconds();
    let mut auth = auth
        .lock()
        .map_err(|_| "remote authentication state poisoned".to_string())?;
    if !auth.allow_auth_attempt(client_ip, now) {
        return Err(RemoteAuthError::RateLimited.to_string());
    }
    match auth.authenticate_password(
        &input.password,
        input.device.as_deref().unwrap_or("remote-browser"),
        now,
    ) {
        Ok(token) => serde_json::to_string(&serde_json::json!({
            "token": token,
            "expiresIn": 24 * 60 * 60,
        }))
        .map_err(|error| error.to_string()),
        Err(error) => {
            auth.record_failed_auth_attempt(client_ip, now);
            Err(error.to_string())
        }
    }
}

pub(super) fn remote_password_store_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("app.tranhoangpich.cmdspace");
    let _ = fs::create_dir_all(&path);
    path.push("remote-password.txt");
    path
}

pub(super) fn remote_device_store_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("app.tranhoangpich.cmdspace");
    let _ = fs::create_dir_all(&path);
    path.push("remote-devices.json");
    path
}

pub(super) fn remote_device_registry_key() -> [u8; 32] {
    let mut key = [0_u8; 32];
    getrandom::fill(&mut key).expect("operating system random source must be available");
    key
}

pub(super) fn load_remote_password_verifier(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(verifier) => Ok(Some(verifier.trim().to_string())),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

pub(super) fn delete_remote_password_verifier(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

pub(super) fn store_remote_password_verifier(path: &Path, verifier: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "remote password path has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
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
        .map_err(|error| error.to_string())?;
    file.write_all(verifier.as_bytes())
        .map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    fs::rename(temporary, path).map_err(|error| error.to_string())
}
