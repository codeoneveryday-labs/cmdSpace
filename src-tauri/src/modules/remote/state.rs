use super::super::remote_auth::{now_unix_seconds, RemoteAuth};
use super::super::remote_devices::DeviceRegistry;
use super::super::remote_relay::{RemoteRelay, RemoteRelayIdentity};
use super::super::remote_tunnel::{LocalhostRunTunnel, TunnelSnapshot, TunnelState};
use super::server::lan_ip_addr;
use super::RemoteAccessStatus;
use std::{
    net::{SocketAddr, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread::JoinHandle,
    time::Duration,
};

/// Shared state for the embedded remote access server.
#[derive(Default)]
pub struct RemoteAccessState {
    pub(super) server: Mutex<Option<RemoteServer>>,
}

pub(super) struct RemoteServer {
    pub(super) shutdown: Arc<AtomicBool>,
    pub(super) handle: Option<JoinHandle<()>>,
    pub(super) listen_addr: SocketAddr,
    pub(super) tunnel: Option<LocalhostRunTunnel>,
    pub(super) tunnel_start_error: Option<String>,
    pub(super) auth: Arc<Mutex<RemoteAuth>>,
    pub(super) bootstrap_secret: Option<String>,
    pub(super) devices: Arc<Mutex<DeviceRegistry>>,
    pub(super) relay: Option<RemoteRelay>,
    pub(super) relay_identity: RemoteRelayIdentity,
}

pub(super) fn stop_server(mut server: RemoteServer) {
    if let Some(mut relay) = server.relay.take() {
        relay.stop();
    }
    if let Some(mut tunnel) = server.tunnel.take() {
        tunnel.stop();
    }
    server.shutdown.store(true, Ordering::Relaxed);
    let _ = TcpStream::connect_timeout(&server.listen_addr, Duration::from_millis(200));
    let _ = TcpStream::connect(("127.0.0.1", server.listen_addr.port()));
    if let Some(handle) = server.handle.take() {
        let _ = handle.join();
    }
}

pub(super) fn status(enabled: bool, remote_port: u16) -> RemoteAccessStatus {
    status_with_tunnel(enabled, remote_port, None, None)
}

pub(super) fn status_with_tunnel(
    enabled: bool,
    remote_port: u16,
    bootstrap_secret: Option<String>,
    tunnel: Option<TunnelSnapshot>,
) -> RemoteAccessStatus {
    let lan_url = if enabled && remote_port > 0 {
        lan_ip_addr()
            .map(|address| format!("http://{address}:{remote_port}"))
            .unwrap_or_default()
    } else {
        String::new()
    };
    let tunnel = tunnel.unwrap_or_else(|| TunnelSnapshot {
        state: if enabled {
            TunnelState::Error
        } else {
            TunnelState::Stopped
        },
        public_url: None,
        error: enabled.then(|| "remote tunnel is unavailable".to_string()),
    });
    let public_url = (tunnel.state == TunnelState::Ready)
        .then(|| tunnel.public_url.clone())
        .flatten();
    let url = public_url.clone().unwrap_or_else(|| lan_url.clone());
    RemoteAccessStatus {
        enabled,
        url,
        lan_url,
        public_url,
        port: remote_port,
        tunnel_state: tunnel.state,
        tunnel_error: tunnel.error,
        target_port: None,
        target_reachable: enabled,
        auto_target: false,
        ignored_cmdspace_dev_port: None,
        bootstrap_secret,
    }
}

impl RemoteServer {
    pub(super) fn status(&mut self) -> RemoteAccessStatus {
        let tunnel = self
            .tunnel
            .as_ref()
            .map(LocalhostRunTunnel::snapshot)
            .or_else(|| {
                self.tunnel_start_error
                    .as_ref()
                    .map(|error| TunnelSnapshot {
                        state: TunnelState::Error,
                        public_url: None,
                        error: Some(error.clone()),
                    })
            });
        let now = now_unix_seconds();
        let bootstrap_secret = match self.auth.lock() {
            Ok(auth) if auth.password_configured() => {
                self.bootstrap_secret = None;
                None
            }
            Ok(mut auth) => {
                if !auth.bootstrap_available(now) {
                    match auth.reset_password(now) {
                        Ok(secret) => self.bootstrap_secret = Some(secret),
                        Err(error) => {
                            log::warn!("remote setup link refresh failed: {error}");
                            self.bootstrap_secret = None;
                        }
                    }
                }
                self.bootstrap_secret.clone()
            }
            Err(_) => None,
        };
        status_with_tunnel(true, self.listen_addr.port(), bootstrap_secret, tunnel)
    }
}
