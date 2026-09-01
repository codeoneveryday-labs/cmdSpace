use super::super::pty::PtyState;
use super::super::remote_auth::{now_unix_seconds, RemoteAuth};
use super::super::remote_devices::{DeviceRegistry, PairingGrant};
use super::super::remote_relay::{
    identity_path as remote_relay_identity_path, RemoteRelay, RemoteRelayIdentity,
    RELAY_PUBLIC_ORIGIN,
};
use super::super::remote_tunnel::LocalhostRunTunnel;
use super::auth::{
    delete_remote_password_verifier, load_remote_password_verifier, remote_device_registry_key,
    remote_device_store_path, remote_password_store_path,
};
use super::http::remote_ui_dir;
use super::server::{bind_remote_listener, serve};
use super::sessions::{RemoteRuntime, NEXT_REMOTE_RUNTIME_ID, REMOTE_SESSION_ID_START};
use super::state::{status, stop_server, RemoteServer};
use super::{
    RemoteAccessState, RemoteAccessStatus, RemoteDevicePairingStatus, RemotePairedDeviceStatus,
};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
};

#[tauri::command]
pub fn remote_access_status(state: tauri::State<'_, RemoteAccessState>) -> RemoteAccessStatus {
    state
        .server
        .lock()
        .map(|mut server| {
            server
                .as_mut()
                .map(RemoteServer::status)
                .unwrap_or_else(|| status(false, 0))
        })
        .unwrap_or_else(|_| status(false, 0))
}

#[tauri::command]
pub fn remote_access_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, RemoteAccessState>,
    pty_state: tauri::State<'_, PtyState>,
) -> Result<RemoteAccessStatus, String> {
    let mut guard = state
        .server
        .lock()
        .map_err(|_| "remote access state lock poisoned".to_string())?;

    if guard.as_ref().is_some() {
        return Ok(guard
            .as_mut()
            .map(RemoteServer::status)
            .unwrap_or_else(|| status(false, 0)));
    }

    let (listener, listen_addr) = bind_remote_listener()?;
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("remote access nonblocking failed: {e}"))?;

    let shutdown = Arc::new(AtomicBool::new(false));
    let runtime = Arc::new(Mutex::new(RemoteRuntime {
        id: NEXT_REMOTE_RUNTIME_ID.fetch_add(1, Ordering::Relaxed),
        next_id: REMOTE_SESSION_ID_START,
        sessions: HashMap::new(),
    }));
    let password_store_path = Arc::new(remote_password_store_path());
    let (mut auth, bootstrap_secret) = RemoteAuth::new().map_err(|error| error.to_string())?;
    let stored_password = load_remote_password_verifier(password_store_path.as_ref())?;
    if let Some(verifier) = stored_password.as_ref() {
        auth.restore_password_verifier(verifier.clone())
            .map_err(|error| error.to_string())?;
    }
    let auth = Arc::new(Mutex::new(auth));
    let device_store_path = remote_device_store_path();
    let devices = Arc::new(Mutex::new(
        DeviceRegistry::load_or_create(&device_store_path, remote_device_registry_key())
            .map_err(|error| format!("load paired devices failed: {error:?}"))?,
    ));
    let relay_identity = RemoteRelayIdentity::load_or_create(&remote_relay_identity_path())
        .map_err(|error| format!("load stable mobile relay identity failed: {error}"))?;
    let thread_shutdown = Arc::clone(&shutdown);
    let thread_runtime = Arc::clone(&runtime);
    let thread_pty_state = pty_state.inner().clone();
    let thread_auth = Arc::clone(&auth);
    let thread_devices = Arc::clone(&devices);
    let thread_password_store_path = Arc::clone(&password_store_path);
    let remote_ui_dir = Arc::new(remote_ui_dir(&app));
    let handle = thread::Builder::new()
        .name("cmdspace-remote-access".to_string())
        .spawn(move || {
            serve(
                listener,
                thread_shutdown,
                thread_runtime,
                thread_pty_state,
                thread_auth,
                thread_devices,
                thread_password_store_path,
                remote_ui_dir,
            )
        })
        .map_err(|e| format!("remote access thread failed: {e}"))?;

    let (tunnel, tunnel_start_error) = match LocalhostRunTunnel::start(listen_addr.port()) {
        Ok(tunnel) => (Some(tunnel), None),
        Err(error) => {
            log::warn!("remote tunnel unavailable; LAN fallback remains active: {error}");
            (None, Some(error))
        }
    };
    let relay = match RemoteRelay::start(listen_addr.port(), relay_identity.clone()) {
        Ok(relay) => Some(relay),
        Err(error) => {
            log::warn!("stable native relay unavailable; temporary tunnel fallback remains active: {error}");
            None
        }
    };
    let mut server = RemoteServer {
        shutdown,
        handle: Some(handle),
        listen_addr,
        tunnel,
        tunnel_start_error,
        auth,
        bootstrap_secret: stored_password.is_none().then_some(bootstrap_secret),
        devices,
        relay,
        relay_identity,
    };
    let next_status = server.status();
    log::info!(
        "remote access enabled: url={} listen_addr={} mode=builtin-ui",
        next_status.url,
        listen_addr
    );

    *guard = Some(server);
    Ok(next_status)
}

#[tauri::command]
pub fn remote_access_stop(
    state: tauri::State<'_, RemoteAccessState>,
) -> Result<RemoteAccessStatus, String> {
    let server = state
        .server
        .lock()
        .map_err(|_| "remote access state lock poisoned".to_string())?
        .take();
    if let Some(server) = server {
        stop_server(server);
    }
    log::info!("remote access disabled");
    Ok(status(false, 0))
}

#[tauri::command]
pub fn remote_device_pairing_start(
    state: tauri::State<'_, RemoteAccessState>,
    display_name: String,
) -> Result<RemoteDevicePairingStatus, String> {
    let mut guard = state
        .server
        .lock()
        .map_err(|_| "remote access state lock poisoned".to_string())?;
    let server = guard
        .as_mut()
        .ok_or_else(|| "enable remote access before pairing a device".to_string())?;
    if !server.relay.as_ref().is_some_and(RemoteRelay::is_ready) {
        return Err(
            "the stable relay is still connecting; wait a moment before creating a device QR code"
                .to_string(),
        );
    }
    let now = now_unix_seconds();
    let PairingGrant { secret, expires_at } = server
        .devices
        .lock()
        .map_err(|_| "remote device registry poisoned".to_string())?
        .issue_grant(
            if display_name.trim().is_empty() {
                "cmdSpace iOS device"
            } else {
                display_name.trim()
            },
            DeviceRegistry::default_native_capability(),
            now,
            10 * 60,
        );
    Ok(RemoteDevicePairingStatus {
        url: RELAY_PUBLIC_ORIGIN.to_string(),
        relay: RELAY_PUBLIC_ORIGIN.to_string(),
        relay_id: server.relay_identity.relay_id.clone(),
        secret,
        expires_at,
    })
}

#[tauri::command]
pub fn remote_device_list(
    state: tauri::State<'_, RemoteAccessState>,
) -> Result<Vec<RemotePairedDeviceStatus>, String> {
    let guard = state
        .server
        .lock()
        .map_err(|_| "remote access state lock poisoned".to_string())?;
    let server = guard
        .as_ref()
        .ok_or_else(|| "enable remote access before listing devices".to_string())?;
    let devices = server
        .devices
        .lock()
        .map_err(|_| "remote device registry poisoned".to_string())?;
    Ok(devices
        .devices()
        .iter()
        .map(|device| RemotePairedDeviceStatus {
            id: device.id.clone(),
            display_name: device.display_name.clone(),
            revoked: device.revoked_at.is_some(),
        })
        .collect())
}

#[tauri::command]
pub fn remote_device_revoke(
    state: tauri::State<'_, RemoteAccessState>,
    device_id: String,
) -> Result<Vec<RemotePairedDeviceStatus>, String> {
    let guard = state
        .server
        .lock()
        .map_err(|_| "remote access state lock poisoned".to_string())?;
    let server = guard
        .as_ref()
        .ok_or_else(|| "enable remote access before revoking a device".to_string())?;
    let mut devices = server
        .devices
        .lock()
        .map_err(|_| "remote device registry poisoned".to_string())?;
    devices
        .revoke(&device_id, now_unix_seconds())
        .map_err(|_| "paired device was not found".to_string())?;
    devices
        .save()
        .map_err(|error| format!("save paired devices failed: {error:?}"))?;
    Ok(devices
        .devices()
        .iter()
        .map(|device| RemotePairedDeviceStatus {
            id: device.id.clone(),
            display_name: device.display_name.clone(),
            revoked: device.revoked_at.is_some(),
        })
        .collect())
}

#[tauri::command]
pub fn remote_access_reset_password(
    state: tauri::State<'_, RemoteAccessState>,
) -> Result<RemoteAccessStatus, String> {
    let mut guard = state
        .server
        .lock()
        .map_err(|_| "remote access state lock poisoned".to_string())?;
    let server = guard
        .as_mut()
        .ok_or_else(|| "enable remote access before resetting its password".to_string())?;

    delete_remote_password_verifier(&remote_password_store_path())?;
    let bootstrap_secret = server
        .auth
        .lock()
        .map_err(|_| "remote authentication state poisoned".to_string())?
        .reset_password(now_unix_seconds())
        .map_err(|error| error.to_string())?;
    server.bootstrap_secret = Some(bootstrap_secret);
    log::info!("remote access password reset; existing sessions revoked");

    Ok(server.status())
}
