//! Stable Cloudflare relay transport for native mobile devices.
//!
//! The relay only multiplexes text frames. Every device gets a loopback
//! websocket to the existing native v3 handler, so pairing, authorization,
//! workspace access and PTY ownership remain desktop-owned.

use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

/// Public HTTPS origin embedded in pairing QR codes. The mobile client changes
/// this to WSS only after validating the origin.
pub const RELAY_PUBLIC_ORIGIN: &str = "https://cmdspace-relay.shayugoodkid.workers.dev";
pub(crate) const RELAY_WEBSOCKET_ORIGIN: &str = "wss://cmdspace-relay.shayugoodkid.workers.dev";
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(10);
const HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(30);

pub(crate) struct RelayHeartbeat {
    last_sent: Instant,
    last_acknowledged: Instant,
}

impl RelayHeartbeat {
    pub(crate) fn new(now: Instant) -> Self {
        Self {
            last_sent: now,
            last_acknowledged: now,
        }
    }

    pub(crate) fn should_send(&self, now: Instant) -> bool {
        now.duration_since(self.last_sent) >= HEARTBEAT_INTERVAL
    }

    pub(crate) fn record_sent(&mut self, now: Instant) {
        self.last_sent = now;
    }

    pub(crate) fn record_acknowledgement(&mut self, now: Instant) {
        self.last_acknowledged = now;
    }

    pub(crate) fn has_timed_out(&self, now: Instant) -> bool {
        now.duration_since(self.last_acknowledged) >= HEARTBEAT_TIMEOUT
    }
}

#[path = "remote_relay_identity.rs"]
mod identity;
pub use identity::RemoteRelayIdentity;
#[path = "remote_relay_connection.rs"]
mod connection;
use connection::relay_loop;

pub struct RemoteRelay {
    shutdown: Arc<AtomicBool>,
    ready: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl RemoteRelay {
    pub fn start(local_port: u16, identity: RemoteRelayIdentity) -> Result<Self, String> {
        let shutdown = Arc::new(AtomicBool::new(false));
        let ready = Arc::new(AtomicBool::new(false));
        let thread_shutdown = Arc::clone(&shutdown);
        let thread_ready = Arc::clone(&ready);
        let handle = thread::Builder::new()
            .name("cmdspace-native-relay".to_string())
            .spawn(move || relay_loop(local_port, identity, thread_shutdown, thread_ready))
            .map_err(|error| error.to_string())?;
        Ok(Self {
            shutdown,
            ready,
            handle: Some(handle),
        })
    }

    pub fn is_ready(&self) -> bool {
        self.ready.load(Ordering::Relaxed)
    }

    pub fn stop(&mut self) {
        self.shutdown.store(true, Ordering::Relaxed);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for RemoteRelay {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn identity_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("app.tranhoangpich.cmdspace");
    path.push("remote-relay.json");
    path
}
