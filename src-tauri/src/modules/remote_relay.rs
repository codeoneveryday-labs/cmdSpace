//! Stable Cloudflare relay transport for native mobile devices.
//!
//! The relay only multiplexes text frames. Every device gets a loopback
//! websocket to the existing native v3 handler, so pairing, authorization,
//! workspace access and PTY ownership remain desktop-owned.

use super::remote_protocol::{
    RemoteRelayAdmission, RemoteRelayControlMessage, RemoteRelayRole, REMOTE_RELAY_PROTOCOL_VERSION,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    net::TcpStream,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, Sender},
        Arc,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
use tungstenite::{stream::MaybeTlsStream, Error as WebSocketError, Message, WebSocket};

/// Public HTTPS origin embedded in pairing QR codes. The mobile client changes
/// this to WSS only after validating the origin.
pub const RELAY_PUBLIC_ORIGIN: &str = "https://cmdspace-relay.shayugoodkid.workers.dev";
const RELAY_WEBSOCKET_ORIGIN: &str = "wss://cmdspace-relay.shayugoodkid.workers.dev";
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(10);
const HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(30);

pub(crate) struct RelayHeartbeat {
    last_sent: Instant,
    last_acknowledged: Instant,
}

impl RelayHeartbeat {
    pub(crate) fn new(now: Instant) -> Self {
        Self { last_sent: now, last_acknowledged: now }
    }

    pub(crate) fn should_send(&self, now: Instant) -> bool {
        now.duration_since(self.last_sent) >= HEARTBEAT_INTERVAL
    }

    pub(crate) fn record_sent(&mut self, now: Instant) { self.last_sent = now; }

    pub(crate) fn record_acknowledgement(&mut self, now: Instant) { self.last_acknowledged = now; }

    pub(crate) fn has_timed_out(&self, now: Instant) -> bool {
        now.duration_since(self.last_acknowledged) >= HEARTBEAT_TIMEOUT
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RemoteRelayIdentity {
    pub relay_id: String,
    pub credential: String,
}

impl RemoteRelayIdentity {
    pub fn load_or_create(path: &Path) -> Result<Self, String> {
        match fs::read_to_string(path) {
            Ok(value) => serde_json::from_str(&value).map_err(|error| error.to_string()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let identity = Self { relay_id: random_token()?, credential: random_token()? };
                let parent = path.parent().ok_or_else(|| "relay identity path has no parent".to_string())?;
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
                fs::write(path, serde_json::to_vec(&identity).map_err(|error| error.to_string())?)
                    .map_err(|error| error.to_string())?;
                Ok(identity)
            }
            Err(error) => Err(error.to_string()),
        }
    }

    pub fn endpoint(&self) -> String {
        format!("{RELAY_WEBSOCKET_ORIGIN}/relay/{}", self.relay_id)
    }
}

fn random_token() -> Result<String, String> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes).map_err(|error| error.to_string())?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

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
        Ok(Self { shutdown, ready, handle: Some(handle) })
    }

    pub fn is_ready(&self) -> bool { self.ready.load(Ordering::Relaxed) }

    pub fn stop(&mut self) {
        self.shutdown.store(true, Ordering::Relaxed);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for RemoteRelay {
    fn drop(&mut self) { self.stop(); }
}

enum RelayOutbound {
    DeviceFrame { connection_id: String, payload: String },
    DeviceClose { connection_id: String },
}

fn relay_loop(local_port: u16, identity: RemoteRelayIdentity, shutdown: Arc<AtomicBool>, ready: Arc<AtomicBool>) {
    while !shutdown.load(Ordering::Relaxed) {
        match connect_relay(&identity) {
            Ok(socket) => run_connection(socket, local_port, &identity, &shutdown, &ready),
            Err(error) => log::warn!("native relay unavailable: {error}"),
        }
        ready.store(false, Ordering::Relaxed);
        for _ in 0..20 {
            if shutdown.load(Ordering::Relaxed) { return; }
            thread::sleep(Duration::from_millis(100));
        }
    }
}

fn connect_relay(identity: &RemoteRelayIdentity) -> Result<WebSocket<MaybeTlsStream<TcpStream>>, String> {
    let (mut socket, _) = tungstenite::connect(identity.endpoint()).map_err(|error| error.to_string())?;
    set_timeout(socket.get_mut());
    let admission = RemoteRelayAdmission {
        version: REMOTE_RELAY_PROTOCOL_VERSION,
        role: RemoteRelayRole::Desktop,
        relay_id: identity.relay_id.clone(),
        credential: identity.credential.clone(),
    };
    socket.send(Message::text(serde_json::to_string(&admission).map_err(|error| error.to_string())?))
        .map_err(|error| error.to_string())?;
    Ok(socket)
}

fn set_timeout(stream: &mut MaybeTlsStream<TcpStream>) {
    match stream {
        MaybeTlsStream::Plain(stream) => {
            let _ = stream.set_read_timeout(Some(Duration::from_millis(50)));
            let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));
        }
        MaybeTlsStream::Rustls(stream) => {
            let _ = stream.sock.set_read_timeout(Some(Duration::from_millis(50)));
            let _ = stream.sock.set_write_timeout(Some(Duration::from_secs(5)));
        }
        _ => {}
    }
}

fn run_connection(
    mut relay: WebSocket<MaybeTlsStream<TcpStream>>,
    local_port: u16,
    identity: &RemoteRelayIdentity,
    shutdown: &Arc<AtomicBool>,
    ready_state: &Arc<AtomicBool>,
) {
    let (outbound_tx, outbound_rx) = mpsc::channel();
    let mut devices: HashMap<String, Sender<String>> = HashMap::new();
    let mut ready = false;
    let mut heartbeat = RelayHeartbeat::new(Instant::now());
    while !shutdown.load(Ordering::Relaxed) {
        let now = Instant::now();
        if heartbeat.has_timed_out(now) {
            log::warn!("native relay heartbeat timed out; reconnecting");
            return;
        }
        if heartbeat.should_send(now) {
            if let Err(error) = send_control(&mut relay, RemoteRelayControlMessage::Heartbeat) {
                log::warn!("native relay heartbeat failed: {error}");
                return;
            }
            heartbeat.record_sent(now);
        }
        if let Err(error) = flush_outbound(&mut relay, &outbound_rx) {
            log::warn!("native relay send failed: {error}");
            return;
        }
        match relay.read() {
            Ok(Message::Text(value)) => {
                let Ok(message) = serde_json::from_str::<RemoteRelayControlMessage>(value.as_ref()) else { continue; };
                match message {
                    RemoteRelayControlMessage::RelayReady { .. } => {
                        ready = true;
                        heartbeat.record_acknowledgement(Instant::now());
                        ready_state.store(true, Ordering::Relaxed);
                        log::info!("native relay ready: relay_id={}", identity.relay_id);
                    }
                    RemoteRelayControlMessage::HeartbeatAck => {
                        heartbeat.record_acknowledgement(Instant::now());
                    }
                    RemoteRelayControlMessage::DeviceOpen { connection_id } if ready => {
                        let (to_local_tx, to_local_rx) = mpsc::channel();
                        devices.insert(connection_id.clone(), to_local_tx);
                        spawn_local_device_bridge(local_port, connection_id, to_local_rx, outbound_tx.clone(), Arc::clone(shutdown));
                    }
                    RemoteRelayControlMessage::DeviceFrame { connection_id, payload } => {
                        if let Some(device) = devices.get(&connection_id) { let _ = device.send(payload); }
                    }
                    RemoteRelayControlMessage::DeviceClose { connection_id } => { devices.remove(&connection_id); }
                    _ => {}
                }
            }
            Ok(Message::Ping(payload)) => { if relay.send(Message::Pong(payload)).is_err() { return; } }
            Ok(Message::Close(_)) => return,
            Ok(_) => {}
            Err(WebSocketError::Io(error)) if matches!(error.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => {}
            Err(error) => { log::warn!("native relay disconnected: {error}"); return; }
        }
    }
}

fn flush_outbound(
    relay: &mut WebSocket<MaybeTlsStream<TcpStream>>,
    outbound: &Receiver<RelayOutbound>,
) -> Result<(), String> {
    while let Ok(message) = outbound.try_recv() {
        let control = match message {
            RelayOutbound::DeviceFrame { connection_id, payload } => RemoteRelayControlMessage::DeviceFrame { connection_id, payload },
            RelayOutbound::DeviceClose { connection_id } => RemoteRelayControlMessage::DeviceClose { connection_id },
        };
        send_control(relay, control)?;
    }
    Ok(())
}

fn send_control(
    relay: &mut WebSocket<MaybeTlsStream<TcpStream>>,
    control: RemoteRelayControlMessage,
) -> Result<(), String> {
    relay.send(Message::text(serde_json::to_string(&control).map_err(|error| error.to_string())?))
        .map_err(|error| error.to_string())
}

fn spawn_local_device_bridge(
    local_port: u16,
    connection_id: String,
    inbound: Receiver<String>,
    outbound: Sender<RelayOutbound>,
    shutdown: Arc<AtomicBool>,
) {
    thread::spawn(move || {
        let result = (|| -> Result<(), String> {
            let stream = TcpStream::connect(("127.0.0.1", local_port)).map_err(|error| error.to_string())?;
            stream.set_read_timeout(Some(Duration::from_millis(50))).map_err(|error| error.to_string())?;
            let (mut socket, _) = tungstenite::client(
                format!("ws://127.0.0.1:{local_port}/api/remote/device/ws"), stream,
            ).map_err(|error| error.to_string())?;
            loop {
                while let Ok(payload) = inbound.try_recv() {
                    socket.send(Message::text(payload)).map_err(|error| error.to_string())?;
                }
                match socket.read() {
                    Ok(Message::Text(payload)) => {
                        outbound.send(RelayOutbound::DeviceFrame { connection_id: connection_id.clone(), payload: payload.to_string() }).map_err(|error| error.to_string())?;
                    }
                    Ok(Message::Close(_)) => return Ok(()),
                    Ok(Message::Ping(payload)) => socket.send(Message::Pong(payload)).map_err(|error| error.to_string())?,
                    Ok(_) => {}
                    Err(WebSocketError::Io(error)) if matches!(error.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => {
                        if shutdown.load(Ordering::Relaxed) { return Ok(()); }
                    }
                    Err(error) => return Err(error.to_string()),
                }
            }
        })();
        if let Err(error) = result { log::debug!("native device relay bridge ended: {error}"); }
        let _ = outbound.send(RelayOutbound::DeviceClose { connection_id });
    });
}

pub fn identity_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("app.tranhoangpich.cmdspace");
    path.push("remote-relay.json");
    path
}
