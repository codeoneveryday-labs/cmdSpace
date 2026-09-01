use super::super::{pty::PtyState, remote_auth::RemoteAuth, remote_devices::DeviceRegistry};
use super::sessions::RemoteRuntime;
#[path = "server_network.rs"]
mod network;
#[path = "server_router.rs"]
mod router;
pub(super) use network::lan_ip_addr;
// Keep this helper at the historical server seam for focused LAN-selection tests.
#[allow(unused_imports)]
pub(super) use network::select_lan_ip;
pub(super) use router::handle_connection;
use std::{
    net::{IpAddr, SocketAddr, TcpListener},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};

/// Owns the listener accept loop and delegates each connection to the remote
/// request router while preserving the shared runtime and authentication state.
#[allow(clippy::too_many_arguments)]
pub(super) fn serve(
    listener: TcpListener,
    shutdown: Arc<AtomicBool>,
    runtime: Arc<Mutex<RemoteRuntime>>,
    pty_state: PtyState,
    auth: Arc<Mutex<RemoteAuth>>,
    devices: Arc<Mutex<DeviceRegistry>>,
    password_store_path: Arc<PathBuf>,
    remote_ui_dir: Arc<PathBuf>,
) {
    while !shutdown.load(Ordering::Relaxed) {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let shutdown = Arc::clone(&shutdown);
                let runtime = Arc::clone(&runtime);
                let pty_state = pty_state.clone();
                let auth = Arc::clone(&auth);
                let devices = Arc::clone(&devices);
                let password_store_path = Arc::clone(&password_store_path);
                let remote_ui_dir = Arc::clone(&remote_ui_dir);
                thread::spawn(move || {
                    handle_connection(
                        &mut stream,
                        shutdown,
                        runtime,
                        pty_state,
                        auth,
                        devices,
                        password_store_path,
                        remote_ui_dir,
                    )
                });
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(50));
            }
            Err(error) => {
                log::warn!("remote access accept failed: {error}");
                thread::sleep(Duration::from_millis(200));
            }
        }
    }
}
pub(super) fn bind_remote_listener() -> Result<(TcpListener, SocketAddr), String> {
    const REMOTE_PORT: u16 = 53631;
    let bind_addr = SocketAddr::new(IpAddr::from([0, 0, 0, 0]), REMOTE_PORT);
    TcpListener::bind(bind_addr)
        .and_then(|listener| {
            let listen_addr = listener.local_addr()?;
            Ok((listener, listen_addr))
        })
        .map_err(|e| {
            format!("remote access bind failed on {bind_addr}. Make sure the network interface is available: {e}")
        })
}
