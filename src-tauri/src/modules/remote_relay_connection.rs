use super::super::remote_protocol::{
    RemoteRelayAdmission, RemoteRelayControlMessage, RemoteRelayRole, REMOTE_RELAY_PROTOCOL_VERSION,
};
use super::{RelayHeartbeat, RemoteRelayIdentity};
use std::collections::HashMap;
use std::net::TcpStream;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc::{self, Receiver, Sender},
    Arc,
};
use std::thread;
use std::time::{Duration, Instant};
use tungstenite::{stream::MaybeTlsStream, Error as WebSocketError, Message, WebSocket};

enum RelayOutbound {
    DeviceFrame {
        connection_id: String,
        payload: String,
    },
    DeviceClose {
        connection_id: String,
    },
}

pub fn relay_loop(
    local_port: u16,
    identity: RemoteRelayIdentity,
    shutdown: Arc<AtomicBool>,
    ready: Arc<AtomicBool>,
) {
    while !shutdown.load(Ordering::Relaxed) {
        match connect_relay(&identity) {
            Ok(socket) => run_connection(socket, local_port, &identity, &shutdown, &ready),
            Err(error) => log::warn!("native relay unavailable: {error}"),
        }
        ready.store(false, Ordering::Relaxed);
        for _ in 0..20 {
            if shutdown.load(Ordering::Relaxed) {
                return;
            }
            thread::sleep(Duration::from_millis(100));
        }
    }
}

fn connect_relay(
    identity: &RemoteRelayIdentity,
) -> Result<WebSocket<MaybeTlsStream<TcpStream>>, String> {
    let (mut socket, _) =
        tungstenite::connect(identity.endpoint()).map_err(|error| error.to_string())?;
    set_timeout(socket.get_mut());
    let admission = RemoteRelayAdmission {
        version: REMOTE_RELAY_PROTOCOL_VERSION,
        role: RemoteRelayRole::Desktop,
        relay_id: identity.relay_id.clone(),
        credential: identity.credential.clone(),
    };
    socket
        .send(Message::text(
            serde_json::to_string(&admission).map_err(|error| error.to_string())?,
        ))
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
            let _ = stream
                .sock
                .set_read_timeout(Some(Duration::from_millis(50)));
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
                let Ok(message) = serde_json::from_str::<RemoteRelayControlMessage>(value.as_ref())
                else {
                    continue;
                };
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
                        spawn_local_device_bridge(
                            local_port,
                            connection_id,
                            to_local_rx,
                            outbound_tx.clone(),
                            Arc::clone(shutdown),
                        );
                    }
                    RemoteRelayControlMessage::DeviceFrame {
                        connection_id,
                        payload,
                    } => {
                        if let Some(device) = devices.get(&connection_id) {
                            let _ = device.send(payload);
                        }
                    }
                    RemoteRelayControlMessage::DeviceClose { connection_id } => {
                        devices.remove(&connection_id);
                    }
                    _ => {}
                }
            }
            Ok(Message::Ping(payload)) => {
                if relay.send(Message::Pong(payload)).is_err() {
                    return;
                }
            }
            Ok(Message::Close(_)) => return,
            Ok(_) => {}
            Err(WebSocketError::Io(error))
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) => {}
            Err(error) => {
                log::warn!("native relay disconnected: {error}");
                return;
            }
        }
    }
}

fn flush_outbound(
    relay: &mut WebSocket<MaybeTlsStream<TcpStream>>,
    outbound: &Receiver<RelayOutbound>,
) -> Result<(), String> {
    while let Ok(message) = outbound.try_recv() {
        let control = match message {
            RelayOutbound::DeviceFrame {
                connection_id,
                payload,
            } => RemoteRelayControlMessage::DeviceFrame {
                connection_id,
                payload,
            },
            RelayOutbound::DeviceClose { connection_id } => {
                RemoteRelayControlMessage::DeviceClose { connection_id }
            }
        };
        send_control(relay, control)?;
    }
    Ok(())
}

fn send_control(
    relay: &mut WebSocket<MaybeTlsStream<TcpStream>>,
    control: RemoteRelayControlMessage,
) -> Result<(), String> {
    relay
        .send(Message::text(
            serde_json::to_string(&control).map_err(|error| error.to_string())?,
        ))
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
            let stream =
                TcpStream::connect(("127.0.0.1", local_port)).map_err(|error| error.to_string())?;
            stream
                .set_read_timeout(Some(Duration::from_millis(50)))
                .map_err(|error| error.to_string())?;
            let (mut socket, _) = tungstenite::client(
                format!("ws://127.0.0.1:{local_port}/api/remote/device/ws"),
                stream,
            )
            .map_err(|error| error.to_string())?;
            loop {
                while let Ok(payload) = inbound.try_recv() {
                    socket
                        .send(Message::text(payload))
                        .map_err(|error| error.to_string())?;
                }
                match socket.read() {
                    Ok(Message::Text(payload)) => {
                        outbound
                            .send(RelayOutbound::DeviceFrame {
                                connection_id: connection_id.clone(),
                                payload: payload.to_string(),
                            })
                            .map_err(|error| error.to_string())?;
                    }
                    Ok(Message::Close(_)) => return Ok(()),
                    Ok(Message::Ping(payload)) => socket
                        .send(Message::Pong(payload))
                        .map_err(|error| error.to_string())?,
                    Ok(_) => {}
                    Err(WebSocketError::Io(error))
                        if matches!(
                            error.kind(),
                            std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                        ) =>
                    {
                        if shutdown.load(Ordering::Relaxed) {
                            return Ok(());
                        }
                    }
                    Err(error) => return Err(error.to_string()),
                }
            }
        })();
        if let Err(error) = result {
            log::debug!("native device relay bridge ended: {error}");
        }
        let _ = outbound.send(RelayOutbound::DeviceClose { connection_id });
    });
}
