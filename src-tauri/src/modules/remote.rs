use super::db;
#[cfg(windows)]
use super::pty::shell_init;
use super::pty::PtyState;
use super::remote_auth::{now_unix_seconds, RemoteAuth, RemoteAuthError};
use super::remote_protocol::{
    ClientMessage, RemoteClientEnvelope, RemoteProtocolSession, RemoteServerEnvelope,
    ServerMessage, Utf8StreamDecoder,
};
use super::remote_tunnel::{LocalhostRunTunnel, TunnelSnapshot, TunnelState};
use super::workspace;
#[cfg(windows)]
use super::workspace::WorkspaceEnv;
use serde::Serialize;
use std::{
    collections::{HashMap, VecDeque},
    fs,
    io::{Read, Write},
    net::{IpAddr, SocketAddr, TcpListener, TcpStream, UdpSocket},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Condvar, Mutex,
    },
    thread::{self, JoinHandle},
    time::Duration,
};

use tungstenite::{protocol::Role, Error as WebSocketError, Message, WebSocket};

#[derive(Default)]
pub struct RemoteAccessState {
    server: Mutex<Option<RemoteServer>>,
}

struct RemoteServer {
    shutdown: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
    listen_addr: SocketAddr,
    tunnel: Option<LocalhostRunTunnel>,
    tunnel_start_error: Option<String>,
    auth: Arc<Mutex<RemoteAuth>>,
    bootstrap_secret: Option<String>,
}

const REMOTE_OUTPUT_LIMIT: usize = 512;
const REMOTE_SESSION_ID_START: u64 = u32::MAX as u64 + 1;
static NEXT_REMOTE_RUNTIME_ID: AtomicU64 = AtomicU64::new(1);

struct RemoteRuntime {
    id: u64,
    next_id: u64,
    sessions: HashMap<u64, Arc<RemoteTerminal>>,
}

struct RemoteTerminal {
    cwd: Option<String>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Mutex<Box<dyn portable_pty::MasterPty + Send>>,
    killer: Mutex<Box<dyn portable_pty::ChildKiller + Send + Sync>>,
    output: Mutex<RemoteOutput>,
    changed: Condvar,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoteRuntimeSessionInfo {
    id: u64,
    title: String,
    cwd: Option<String>,
}

struct RemoteOutput {
    next_seq: u64,
    chunks: VecDeque<(u64, Vec<u8>)>,
    exited: bool,
}

#[derive(Debug)]
struct RemoteResponse {
    status: &'static str,
    content_type: &'static str,
    body: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoteUiState {
    workspaces: Vec<db::WorkspaceRow>,
    recent_workspaces: Vec<db::RecentWorkspaceRow>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteAccessStatus {
    enabled: bool,
    url: String,
    lan_url: String,
    public_url: Option<String>,
    port: u16,
    tunnel_state: TunnelState,
    tunnel_error: Option<String>,
    /// Kept for frontend/backward compatibility while remote access moves
    /// from project-port forwarding to cmdSpace's own web UI.
    target_port: Option<u16>,
    target_reachable: bool,
    auto_target: bool,
    ignored_cmdspace_dev_port: Option<u16>,
    bootstrap_secret: Option<String>,
}

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
    let thread_shutdown = Arc::clone(&shutdown);
    let thread_runtime = Arc::clone(&runtime);
    let thread_pty_state = pty_state.inner().clone();
    let thread_auth = Arc::clone(&auth);
    let thread_password_store_path = Arc::clone(&password_store_path);
    let handle = thread::Builder::new()
        .name("cmdspace-remote-access".to_string())
        .spawn(move || {
            serve(
                listener,
                thread_shutdown,
                thread_runtime,
                thread_pty_state,
                thread_auth,
                thread_password_store_path,
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
    let mut server = RemoteServer {
        shutdown,
        handle: Some(handle),
        listen_addr,
        tunnel,
        tunnel_start_error,
        auth,
        bootstrap_secret: stored_password.is_none().then_some(bootstrap_secret),
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

fn stop_server(mut server: RemoteServer) {
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

fn status(enabled: bool, remote_port: u16) -> RemoteAccessStatus {
    status_with_tunnel(enabled, remote_port, None, None)
}

fn status_with_tunnel(
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
    fn status(&mut self) -> RemoteAccessStatus {
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

fn bind_remote_listener() -> Result<(TcpListener, SocketAddr), String> {
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

fn lan_ip_addr() -> Option<IpAddr> {
    interface_lan_ip().or_else(route_lan_ip)
}

fn route_lan_ip() -> Option<IpAddr> {
    UdpSocket::bind(("0.0.0.0", 0))
        .and_then(|socket| {
            let _ = socket.connect(("8.8.8.8", 80));
            socket.local_addr()
        })
        .map(|addr| addr.ip())
        .ok()
        .and_then(|address| select_lan_ip([address]))
}

fn select_lan_ip(candidates: impl IntoIterator<Item = IpAddr>) -> Option<IpAddr> {
    let mut public_candidate = None;
    for candidate in candidates {
        let IpAddr::V4(candidate) = candidate else {
            continue;
        };
        if candidate.is_unspecified()
            || candidate.is_loopback()
            || candidate.is_link_local()
            || candidate.is_multicast()
        {
            continue;
        }
        if candidate.is_private() {
            return Some(IpAddr::V4(candidate));
        }
        public_candidate.get_or_insert(IpAddr::V4(candidate));
    }
    public_candidate
}

#[cfg(unix)]
fn interface_lan_ip() -> Option<IpAddr> {
    struct InterfaceList(*mut libc::ifaddrs);

    impl Drop for InterfaceList {
        fn drop(&mut self) {
            // SAFETY: `self.0` is the exact list returned by `getifaddrs` and this
            // RAII owner is created only after that call succeeds.
            unsafe { libc::freeifaddrs(self.0) };
        }
    }

    let mut head = std::ptr::null_mut();
    // SAFETY: `head` is a valid out-pointer and the successful result is owned
    // immediately by `InterfaceList`, which frees it on every return path.
    if unsafe { libc::getifaddrs(&mut head) } != 0 || head.is_null() {
        return None;
    }
    let interfaces = InterfaceList(head);
    let mut cursor = interfaces.0;
    let mut candidates = Vec::new();
    while !cursor.is_null() {
        // SAFETY: every node belongs to the live `InterfaceList`; `ifa_next` is
        // traversed only until the documented null terminator.
        let interface = unsafe { &*cursor };
        if !interface.ifa_addr.is_null()
            && interface.ifa_flags & libc::IFF_UP as u32 != 0
            // SAFETY: the pointer was checked for null and the family field is
            // common to all sockaddr variants.
            && unsafe { (*interface.ifa_addr).sa_family as i32 } == libc::AF_INET
        {
            // SAFETY: AF_INET above guarantees this sockaddr is a sockaddr_in.
            let socket = unsafe { &*(interface.ifa_addr.cast::<libc::sockaddr_in>()) };
            candidates.push(IpAddr::V4(std::net::Ipv4Addr::from(
                socket.sin_addr.s_addr.to_ne_bytes(),
            )));
        }
        cursor = interface.ifa_next;
    }
    select_lan_ip(candidates)
}

#[cfg(windows)]
fn interface_lan_ip() -> Option<IpAddr> {
    use windows_sys::Win32::{
        Foundation::{ERROR_BUFFER_OVERFLOW, NO_ERROR},
        NetworkManagement::{
            IpHelper::{
                GetAdaptersAddresses, GAA_FLAG_SKIP_ANYCAST, GAA_FLAG_SKIP_DNS_SERVER,
                GAA_FLAG_SKIP_FRIENDLY_NAME, GAA_FLAG_SKIP_MULTICAST, IP_ADAPTER_ADDRESSES_LH,
            },
            Ndis::IfOperStatusUp,
        },
        Networking::WinSock::{AF_INET, SOCKADDR_IN},
    };

    const INITIAL_BUFFER_BYTES: usize = 15 * 1024;
    let word_size = std::mem::size_of::<usize>();
    let mut byte_capacity = INITIAL_BUFFER_BYTES;
    for _ in 0..2 {
        let words = byte_capacity.div_ceil(word_size);
        let mut buffer = vec![0_usize; words];
        let mut required_bytes = (buffer.len() * word_size) as u32;
        let flags = GAA_FLAG_SKIP_ANYCAST
            | GAA_FLAG_SKIP_MULTICAST
            | GAA_FLAG_SKIP_DNS_SERVER
            | GAA_FLAG_SKIP_FRIENDLY_NAME;
        // SAFETY: the usize-backed buffer is suitably aligned and writable for
        // `required_bytes`; all pointers derived from it stay within this call's
        // buffer lifetime.
        let result = unsafe {
            GetAdaptersAddresses(
                AF_INET as u32,
                flags,
                std::ptr::null(),
                buffer.as_mut_ptr().cast::<IP_ADAPTER_ADDRESSES_LH>(),
                &mut required_bytes,
            )
        };
        if result == ERROR_BUFFER_OVERFLOW {
            byte_capacity = required_bytes as usize;
            continue;
        }
        if result != NO_ERROR {
            return None;
        }

        let mut candidates = Vec::new();
        let mut adapter = buffer.as_mut_ptr().cast::<IP_ADAPTER_ADDRESSES_LH>();
        while !adapter.is_null() {
            // SAFETY: successful `GetAdaptersAddresses` populated a linked list
            // entirely inside the still-live buffer.
            let current = unsafe { &*adapter };
            if current.OperStatus == IfOperStatusUp {
                let mut unicast = current.FirstUnicastAddress;
                while !unicast.is_null() {
                    // SAFETY: each unicast node belongs to the current adapter's
                    // list inside the same live API buffer.
                    let address = unsafe { &*unicast };
                    let socket = address.Address.lpSockaddr;
                    if !socket.is_null()
                        // SAFETY: `socket` is non-null and sockaddr family is the
                        // common prefix for every socket address variant.
                        && unsafe { (*socket).sa_family } == AF_INET
                    {
                        // SAFETY: AF_INET above guarantees a SOCKADDR_IN value;
                        // reading the byte union does not outlive the API buffer.
                        let octets =
                            unsafe { (*(socket.cast::<SOCKADDR_IN>())).sin_addr.S_un.S_un_b };
                        candidates.push(IpAddr::V4(std::net::Ipv4Addr::new(
                            octets.s_b1,
                            octets.s_b2,
                            octets.s_b3,
                            octets.s_b4,
                        )));
                    }
                    unicast = address.Next;
                }
            }
            adapter = current.Next;
        }
        return select_lan_ip(candidates);
    }
    None
}

#[cfg(not(any(unix, windows)))]
fn interface_lan_ip() -> Option<IpAddr> {
    None
}

fn serve(
    listener: TcpListener,
    shutdown: Arc<AtomicBool>,
    runtime: Arc<Mutex<RemoteRuntime>>,
    pty_state: PtyState,
    auth: Arc<Mutex<RemoteAuth>>,
    password_store_path: Arc<PathBuf>,
) {
    while !shutdown.load(Ordering::Relaxed) {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let shutdown = Arc::clone(&shutdown);
                let runtime = Arc::clone(&runtime);
                let pty_state = pty_state.clone();
                let auth = Arc::clone(&auth);
                let password_store_path = Arc::clone(&password_store_path);
                thread::spawn(move || {
                    handle_connection(
                        &mut stream,
                        shutdown,
                        runtime,
                        pty_state,
                        auth,
                        password_store_path,
                    )
                });
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                log::warn!("remote access accept failed: {e}");
                thread::sleep(Duration::from_millis(200));
            }
        }
    }
}

fn handle_connection(
    stream: &mut TcpStream,
    shutdown: Arc<AtomicBool>,
    runtime: Arc<Mutex<RemoteRuntime>>,
    pty_state: PtyState,
    auth: Arc<Mutex<RemoteAuth>>,
    password_store_path: Arc<PathBuf>,
) {
    if shutdown.load(Ordering::Relaxed) {
        return;
    }
    if let Err(e) = prepare_client_stream(stream) {
        log::warn!("remote access stream setup failed: {e}");
        return;
    }
    let request = match read_http_request(stream) {
        Ok(request) => request,
        Err(e) if is_idle_client_read_error(&e) => {
            log::debug!("remote access client closed before sending request: {e}");
            return;
        }
        Err(e) => {
            log::warn!("remote access request read failed: {e}");
            return;
        }
    };
    if request.is_empty() {
        return;
    }

    if is_remote_websocket_upgrade(&request) {
        if request_path(&request).and_then(|path| path.split('?').next()) != Some("/api/remote/ws")
        {
            write_text_response(
                stream,
                "404 Not Found",
                "application/json; charset=utf-8",
                &json_error("websocket endpoint not found"),
            );
            return;
        }
        if !is_remote_websocket_origin_allowed(&request) {
            write_text_response(
                stream,
                "403 Forbidden",
                "application/json; charset=utf-8",
                &json_error("websocket origin is not allowed"),
            );
            return;
        }
        let client_ip = stream
            .peer_addr()
            .map(|address| address.ip())
            .unwrap_or(IpAddr::from([127, 0, 0, 1]));
        handle_remote_websocket(stream, &request, runtime, auth, client_ip);
        return;
    }

    if request_path(&request).is_some_and(|path| path.split('?').next() == Some("/healthz")) {
        write_text_response(
            stream,
            "200 OK",
            "application/json; charset=utf-8",
            "{\"ok\":true,\"service\":\"cmdspace-remote\"}\n",
        );
        return;
    }

    let path = request_path(&request).unwrap_or("/");
    let clean_path = path.split('?').next().unwrap_or(path);
    if clean_path == "/api/remote/auth/status" && request_method(&request) == Some("GET") {
        let password_configured = auth
            .lock()
            .map(|auth| auth.password_configured())
            .unwrap_or(false);
        let body = serde_json::json!({ "passwordConfigured": password_configured }).to_string();
        write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body);
        return;
    }

    if clean_path == "/api/remote/auth/setup" && request_method(&request) == Some("POST") {
        let client_ip = stream
            .peer_addr()
            .map(|address| address.ip())
            .unwrap_or(IpAddr::from([127, 0, 0, 1]));
        match remote_password_setup_response(
            &request,
            &auth,
            client_ip,
            password_store_path.as_ref(),
        ) {
            Ok(body) => {
                write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body)
            }
            Err(error) => write_text_response(
                stream,
                "401 Unauthorized",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }

    if clean_path == "/api/remote/auth/login" && request_method(&request) == Some("POST") {
        let client_ip = stream
            .peer_addr()
            .map(|address| address.ip())
            .unwrap_or(IpAddr::from([127, 0, 0, 1]));
        match remote_password_login_response(&request, &auth, client_ip) {
            Ok(body) => {
                write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body)
            }
            Err(error) => write_text_response(
                stream,
                "401 Unauthorized",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }

    if clean_path.starts_with("/api/remote/") {
        let client_ip = stream
            .peer_addr()
            .map(|address| address.ip())
            .unwrap_or(IpAddr::from([127, 0, 0, 1]));
        if let Err(error) = authorize_remote_http_request(&request, &auth, client_ip) {
            write_text_response(
                stream,
                "401 Unauthorized",
                "application/json; charset=utf-8",
                &json_error(&error),
            );
            return;
        }
    }

    if clean_path == "/api/remote/state" {
        let response =
            remote_state_response().unwrap_or_else(|error| remote_json_error_response(&error));
        write_binary_response(stream, &response);
        return;
    }
    if is_legacy_remote_terminal_path(clean_path) {
        write_text_response(
            stream,
            "410 Gone",
            "application/json; charset=utf-8",
            &json_error("terminal HTTP transport has moved to /api/remote/ws"),
        );
        return;
    }
    if clean_path == "/api/remote/sessions" {
        let response = serde_json::to_string(&pty_state.list_sessions())
            .map_err(|error| error.to_string())
            .map(|body| RemoteResponse {
                status: "200 OK",
                content_type: "application/json; charset=utf-8",
                body: body.into_bytes(),
            })
            .unwrap_or_else(|error| remote_json_error_response(&error));
        write_binary_response(stream, &response);
        return;
    }
    if clean_path == "/api/remote/runtime/sessions" {
        let sessions = runtime
            .lock()
            .map(|guard| {
                guard
                    .sessions
                    .iter()
                    .map(|(id, session)| RemoteRuntimeSessionInfo {
                        id: *id,
                        title: "Remote terminal".to_string(),
                        cwd: session.cwd.clone(),
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let body = serde_json::to_string(&sessions).unwrap_or_else(|_| "[]".to_string());
        write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body);
        return;
    }
    if clean_path == "/api/remote/folders" {
        match remote_folders_response(path) {
            Ok(body) => {
                write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body)
            }
            Err(error) => write_text_response(
                stream,
                "400 Bad Request",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }
    if clean_path == "/api/remote/session" && request_method(&request) == Some("POST") {
        match create_remote_session(&request, &runtime) {
            Ok(body) => {
                write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body)
            }
            Err(error) => write_text_response(
                stream,
                "400 Bad Request",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }
    if let Some(id) = remote_session_id(clean_path, "/events") {
        stream_remote_events(
            stream,
            &runtime,
            id,
            query_number(path, "after").unwrap_or(0),
        );
        return;
    }
    if let Some(id) = remote_session_id(clean_path, "/attach/events") {
        stream_pty_events(stream, &pty_state, id);
        return;
    }
    if let Some(id) = remote_session_id(clean_path, "/snapshot") {
        match pty_snapshot_response(&pty_state, id) {
            Ok(body) => {
                write_text_response(stream, "200 OK", "application/json; charset=utf-8", &body)
            }
            Err(error) => write_text_response(
                stream,
                "404 Not Found",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }
    if let Some(id) = remote_session_id(clean_path, "/input") {
        match remote_session_input(&request, &runtime, &pty_state, id) {
            Ok(()) => write_text_response(stream, "204 No Content", "text/plain", ""),
            Err(error) => write_text_response(
                stream,
                "400 Bad Request",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }
    if let Some(id) = remote_session_id(clean_path, "/resize") {
        match remote_session_resize(&request, &runtime, &pty_state, id) {
            Ok(()) => write_text_response(stream, "204 No Content", "text/plain", ""),
            Err(error) => write_text_response(
                stream,
                "400 Bad Request",
                "application/json; charset=utf-8",
                &json_error(&error),
            ),
        }
        return;
    }
    if let Some(id) = remote_session_id(clean_path, "/close") {
        close_remote_session(&runtime, id);
        write_text_response(stream, "204 No Content", "text/plain", "");
        return;
    }

    let response = remote_asset_response(path, &remote_dist_dir())
        .unwrap_or_else(|error| remote_fallback_response(&error));
    write_binary_response(stream, &response);
}

enum RemoteWebSocketAttachment {
    Runtime {
        id: u64,
        session: Arc<RemoteTerminal>,
        cursor: u64,
        decoder: Utf8StreamDecoder,
    },
}

fn handle_remote_websocket(
    stream: &mut TcpStream,
    request: &[u8],
    runtime: Arc<Mutex<RemoteRuntime>>,
    auth: Arc<Mutex<RemoteAuth>>,
    client_ip: IpAddr,
) {
    let Some(key) = request_header(request, "Sec-WebSocket-Key") else {
        return;
    };
    let accept_key = tungstenite::handshake::derive_accept_key(key.as_bytes());
    let handshake = format!(
        "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {accept_key}\r\n\r\n"
    );
    if stream.write_all(handshake.as_bytes()).is_err() || stream.flush().is_err() {
        return;
    }

    let Ok(socket_stream) = stream.try_clone() else {
        return;
    };
    let mut socket = WebSocket::from_raw_socket(socket_stream, Role::Server, None);
    let _ = socket
        .get_mut()
        .set_read_timeout(Some(Duration::from_millis(100)));
    let runtime_id = runtime.lock().map(|runtime| runtime.id).unwrap_or_default();
    let _ = send_remote_websocket_message(
        &mut socket,
        ServerMessage::Hello {
            authenticated: false,
            runtime_id,
        },
    );
    let mut attachment = None;
    let mut authenticated_generation = None;

    loop {
        if authenticated_generation.is_some_and(|generation| {
            auth.lock()
                .map(|auth| auth.session_generation() != generation)
                .unwrap_or(true)
        }) {
            let _ = socket.close(None);
            return;
        }
        drain_remote_websocket_output(&mut socket, &mut attachment);
        match socket.read() {
            Ok(Message::Text(text)) => {
                let result = serde_json::from_str::<RemoteClientEnvelope>(text.as_ref())
                    .map_err(|error| error.to_string())
                    .and_then(|envelope| {
                        if authenticated_generation.is_none() {
                            let ClientMessage::Auth { token } = envelope.message else {
                                return Err(
                                    "the first WebSocket message must authenticate".to_string()
                                );
                            };
                            authenticated_generation =
                                Some(authenticate_remote_websocket(&auth, client_ip, &token)?);
                            return send_remote_websocket_message(
                                &mut socket,
                                ServerMessage::Authenticated,
                            );
                        }
                        handle_remote_websocket_message(
                            &mut socket,
                            envelope.message,
                            &runtime,
                            &mut attachment,
                        )
                    });
                if let Err(error) = result {
                    log::warn!("remote WebSocket request failed: {error}");
                    let _ = send_remote_websocket_message(
                        &mut socket,
                        ServerMessage::Error {
                            code: "invalid_message".to_string(),
                            message: error,
                            retryable: false,
                        },
                    );
                }
            }
            Ok(Message::Binary(_)) => {
                let _ = send_remote_websocket_message(
                    &mut socket,
                    ServerMessage::Error {
                        code: "binary_not_supported".to_string(),
                        message: "remote protocol messages must be JSON text".to_string(),
                        retryable: false,
                    },
                );
            }
            Ok(Message::Ping(payload)) => {
                if socket.send(Message::Pong(payload)).is_err() {
                    return;
                }
            }
            Ok(Message::Pong(_)) => {}
            Ok(Message::Frame(_)) => {}
            Ok(Message::Close(frame)) => {
                let _ = socket.close(frame);
                return;
            }
            Err(WebSocketError::Io(error))
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) => {}
            Err(_) => return,
        }
    }
}

fn authenticate_remote_websocket(
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

fn remote_password_setup_response(
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

fn remote_password_login_response(
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

fn remote_password_store_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("app.tranhoangpich.cmdspace");
    let _ = fs::create_dir_all(&path);
    path.push("remote-password.txt");
    path
}

fn load_remote_password_verifier(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(verifier) => Ok(Some(verifier.trim().to_string())),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn delete_remote_password_verifier(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn store_remote_password_verifier(path: &Path, verifier: &str) -> Result<(), String> {
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

fn handle_remote_websocket_message(
    socket: &mut WebSocket<TcpStream>,
    message: ClientMessage,
    runtime: &Arc<Mutex<RemoteRuntime>>,
    attachment: &mut Option<RemoteWebSocketAttachment>,
) -> Result<(), String> {
    match message {
        ClientMessage::Auth { .. } => Err("WebSocket session is already authenticated".to_string()),
        ClientMessage::ListSessions => send_remote_sessions(socket, runtime),
        ClientMessage::CreateSession { cwd } => {
            let cwd = authorize_remote_cwd(cwd.as_deref())?;
            let mut guard = runtime
                .lock()
                .map_err(|_| "remote runtime poisoned".to_string())?;
            let existing = guard.sessions.iter().find_map(|(id, session)| {
                let live = session
                    .output
                    .lock()
                    .map(|output| runtime_output_is_live(&output))
                    .unwrap_or(false);
                (session.cwd == cwd && live).then_some(*id)
            });
            if existing.is_none() {
                let session = spawn_remote_terminal(cwd.clone())?;
                let id = guard.next_id;
                guard.next_id = guard.next_id.saturating_add(1);
                guard.sessions.insert(id, session);
            }
            drop(guard);
            send_remote_sessions(socket, runtime)
        }
        ClientMessage::Attach { session_id, after } => {
            *attachment = None;
            let session = session_from_runtime(runtime, session_id)?;
            let chunks = session
                .output
                .lock()
                .map_err(|_| "remote output poisoned".to_string())?
                .chunks
                .iter()
                .filter(|(sequence, _)| *sequence > after)
                .cloned()
                .collect::<Vec<_>>();
            let mut cursor = after;
            let mut decoder = Utf8StreamDecoder::default();
            for (sequence, bytes) in chunks {
                cursor = sequence;
                let data = decoder.push(&bytes);
                if !data.is_empty() {
                    send_remote_websocket_message(
                        socket,
                        ServerMessage::Snapshot {
                            session_id,
                            sequence,
                            data,
                        },
                    )?;
                }
            }
            *attachment = Some(RemoteWebSocketAttachment::Runtime {
                id: session_id,
                session,
                cursor,
                decoder,
            });
            Ok(())
        }
        ClientMessage::Detach { session_id } => {
            if attachment
                .as_ref()
                .is_some_and(|current| remote_websocket_attachment_id(current) == session_id)
            {
                *attachment = None;
            }
            Ok(())
        }
        ClientMessage::Input { session_id, data } => {
            let session = session_from_runtime(runtime, session_id)?;
            let mut writer = session
                .writer
                .lock()
                .map_err(|_| "writer poisoned".to_string())?;
            writer
                .write_all(data.as_bytes())
                .map_err(|error| error.to_string())?;
            writer.flush().map_err(|error| error.to_string())
        }
        ClientMessage::Resize {
            session_id,
            cols,
            rows,
        } => {
            if cols == 0 || rows == 0 {
                return Err("terminal size must be positive".to_string());
            }
            session_from_runtime(runtime, session_id)?
                .master
                .lock()
                .map_err(|_| "master poisoned".to_string())?
                .resize(portable_pty::PtySize {
                    cols: cols.min(400),
                    rows: rows.min(200),
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|error| error.to_string())
        }
        ClientMessage::Close { session_id } => {
            close_remote_session(runtime, session_id);
            if attachment
                .as_ref()
                .is_some_and(|current| remote_websocket_attachment_id(current) == session_id)
            {
                *attachment = None;
            }
            Ok(())
        }
        ClientMessage::Ping => send_remote_websocket_message(socket, ServerMessage::Pong),
    }
}

fn send_remote_sessions(
    socket: &mut WebSocket<TcpStream>,
    runtime: &Arc<Mutex<RemoteRuntime>>,
) -> Result<(), String> {
    let mut sessions = Vec::new();
    let mut runtime_guard = runtime
        .lock()
        .map_err(|_| "remote runtime poisoned".to_string())?;
    runtime_guard.sessions.retain(|_, session| {
        session
            .output
            .lock()
            .map(|output| runtime_output_is_live(&output))
            .unwrap_or(false)
    });
    let runtime_sessions =
        runtime_guard
            .sessions
            .iter()
            .map(|(id, session)| RemoteProtocolSession {
                id: *id,
                title: "Remote terminal".to_string(),
                cwd: session.cwd.clone(),
                agent: None,
                attached: false,
            });
    sessions.extend(runtime_sessions);
    send_remote_websocket_message(socket, ServerMessage::Sessions { sessions })
}

fn drain_remote_websocket_output(
    socket: &mut WebSocket<TcpStream>,
    attachment: &mut Option<RemoteWebSocketAttachment>,
) {
    let Some(current) = attachment else {
        return;
    };
    match current {
        RemoteWebSocketAttachment::Runtime {
            id,
            session,
            cursor,
            decoder,
        } => {
            let (chunks, exited) = session
                .output
                .lock()
                .map(|output| {
                    (
                        output
                            .chunks
                            .iter()
                            .filter(|(sequence, _)| *sequence > *cursor)
                            .cloned()
                            .collect::<Vec<_>>(),
                        output.exited,
                    )
                })
                .unwrap_or_default();
            for (sequence, bytes) in chunks {
                let data = decoder.push(&bytes);
                if !data.is_empty()
                    && send_remote_websocket_message(
                        socket,
                        ServerMessage::Output {
                            session_id: *id,
                            sequence,
                            data,
                        },
                    )
                    .is_err()
                {
                    return;
                }
                *cursor = sequence;
            }
            if exited {
                let _ = send_remote_websocket_message(
                    socket,
                    ServerMessage::Exit {
                        session_id: *id,
                        code: None,
                    },
                );
                *attachment = None;
            }
        }
    }
}

fn remote_websocket_attachment_id(attachment: &RemoteWebSocketAttachment) -> u64 {
    match attachment {
        RemoteWebSocketAttachment::Runtime { id, .. } => *id,
    }
}

fn runtime_output_is_live(output: &RemoteOutput) -> bool {
    !output.exited
}

fn send_remote_websocket_message(
    socket: &mut WebSocket<TcpStream>,
    message: ServerMessage,
) -> Result<(), String> {
    let envelope = RemoteServerEnvelope::new(message);
    let payload = serde_json::to_string(&envelope).map_err(|error| error.to_string())?;
    socket
        .send(Message::text(payload))
        .map_err(|error| error.to_string())
}

fn is_remote_websocket_upgrade(request: &[u8]) -> bool {
    let Some(path) = request_path(request) else {
        return false;
    };
    if path.split('?').next() != Some("/api/remote/ws") || request_method(request) != Some("GET") {
        return false;
    }
    let headers = std::str::from_utf8(request)
        .ok()
        .and_then(|request| request.split_once("\r\n\r\n").map(|(headers, _)| headers));
    let Some(headers) = headers else {
        return false;
    };
    let mut has_upgrade = false;
    let mut has_connection_upgrade = false;
    let mut has_key = false;
    for line in headers.lines().skip(1) {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        match name.trim().to_ascii_lowercase().as_str() {
            "upgrade" => has_upgrade = value.trim().eq_ignore_ascii_case("websocket"),
            "connection" => {
                has_connection_upgrade = value
                    .split(',')
                    .any(|token| token.trim().eq_ignore_ascii_case("upgrade"));
            }
            "sec-websocket-key" => has_key = !value.trim().is_empty(),
            _ => {}
        }
    }
    has_upgrade && has_connection_upgrade && has_key
}

fn is_remote_websocket_origin_allowed(request: &[u8]) -> bool {
    let Some(origin) = request_header(request, "Origin") else {
        // Non-browser clients do not send Origin. Their first frame is still
        // authenticated, and tunnel support adds a stricter provider policy.
        return true;
    };
    let Some(host) = request_header(request, "Host") else {
        return false;
    };
    let Some(origin_host) = origin
        .strip_prefix("http://")
        .or_else(|| origin.strip_prefix("https://"))
    else {
        return false;
    };
    !origin_host.contains('/') && origin_host.eq_ignore_ascii_case(host)
}

fn request_header<'a>(request: &'a [u8], header_name: &str) -> Option<&'a str> {
    let text = std::str::from_utf8(request).ok()?;
    let headers = text.split_once("\r\n\r\n").map(|(headers, _)| headers)?;
    headers.lines().skip(1).find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.trim()
            .eq_ignore_ascii_case(header_name)
            .then_some(value.trim())
    })
}

fn remote_bearer_token(request: &[u8]) -> Option<&str> {
    request_header(request, "Authorization")?
        .strip_prefix("Bearer ")
        .filter(|token| !token.is_empty())
}

fn authorize_remote_http_request(
    request: &[u8],
    auth: &Arc<Mutex<RemoteAuth>>,
    client_ip: IpAddr,
) -> Result<(), String> {
    let now = now_unix_seconds();
    let token =
        remote_bearer_token(request).ok_or_else(|| "authentication required".to_string())?;
    let mut auth = auth
        .lock()
        .map_err(|_| "remote auth state poisoned".to_string())?;
    if !auth.allow_auth_attempt(client_ip, now) {
        return Err(RemoteAuthError::RateLimited.to_string());
    }
    match auth.verify_session_token(token, now) {
        Ok(_) => Ok(()),
        Err(error) => {
            auth.record_failed_auth_attempt(client_ip, now);
            Err(error.to_string())
        }
    }
}

fn is_legacy_remote_terminal_path(path: &str) -> bool {
    matches!(
        path,
        "/api/remote/sessions" | "/api/remote/runtime/sessions" | "/api/remote/session"
    ) || path.starts_with("/api/remote/session/")
}

fn request_method(request: &[u8]) -> Option<&str> {
    std::str::from_utf8(request)
        .ok()?
        .lines()
        .next()?
        .split_whitespace()
        .next()
}

fn request_body(request: &[u8]) -> &str {
    std::str::from_utf8(request)
        .ok()
        .and_then(|value| value.split("\r\n\r\n").nth(1))
        .unwrap_or("")
}

fn query_value<'a>(path: &'a str, key: &str) -> Option<&'a str> {
    path.split('?').nth(1)?.split('&').find_map(|part| {
        let (name, value) = part.split_once('=')?;
        (name == key).then_some(value)
    })
}

fn percent_decode(value: &str) -> Result<String, String> {
    let mut bytes = Vec::with_capacity(value.len());
    let raw = value.as_bytes();
    let mut index = 0;
    while index < raw.len() {
        if raw[index] == b'%' {
            if index + 2 >= raw.len() {
                return Err("invalid folder path encoding".to_string());
            }
            let hex = std::str::from_utf8(&raw[index + 1..index + 3])
                .map_err(|_| "invalid folder path encoding".to_string())?;
            let byte = u8::from_str_radix(hex, 16)
                .map_err(|_| "invalid folder path encoding".to_string())?;
            bytes.push(byte);
            index += 3;
        } else {
            bytes.push(raw[index]);
            index += 1;
        }
    }
    String::from_utf8(bytes).map_err(|_| "folder path is not valid UTF-8".to_string())
}

fn query_number(path: &str, key: &str) -> Option<u64> {
    query_value(path, key)?.parse().ok()
}

fn json_error(error: &str) -> String {
    serde_json::json!({"error": error}).to_string()
}

fn remote_session_id(path: &str, suffix: &str) -> Option<u64> {
    path.strip_prefix("/api/remote/session/")?
        .strip_suffix(suffix)?
        .parse()
        .ok()
}

fn desktop_session_id(session_id: u64) -> Result<u32, String> {
    u32::try_from(session_id).map_err(|_| "remote session does not exist".to_string())
}

fn create_remote_session(
    request: &[u8],
    runtime: &Arc<Mutex<RemoteRuntime>>,
) -> Result<String, String> {
    #[derive(serde::Deserialize)]
    struct Input {
        cwd: Option<String>,
    }
    let input: Input = serde_json::from_str(request_body(request)).map_err(|e| e.to_string())?;
    let cwd = input.cwd.filter(|value| !value.trim().is_empty());
    let cwd = authorize_remote_cwd(cwd.as_deref())?;
    let session = spawn_remote_terminal(cwd)?;
    let mut guard = runtime
        .lock()
        .map_err(|_| "remote runtime poisoned".to_string())?;
    let id = guard.next_id;
    guard.next_id = guard.next_id.saturating_add(1);
    guard.sessions.insert(id, session);
    Ok(serde_json::json!({"id": id, "cols": 120, "rows": 40}).to_string())
}

fn authorize_remote_cwd(cwd: Option<&str>) -> Result<Option<String>, String> {
    let Some(cwd) = cwd else {
        return Ok(None);
    };
    let path = std::fs::canonicalize(cwd).map_err(|e| format!("cwd is not accessible: {e}"))?;
    if !path.is_dir() {
        return Err("cwd is not a directory".to_string());
    }
    let home = dirs::home_dir();
    let launch = workspace::launch_cwd_snapshot();
    let allowed = home.as_deref().is_some_and(|root| path.starts_with(root))
        || launch.as_deref().is_some_and(|root| path.starts_with(root));
    if !allowed {
        return Err("remote cwd must be inside the user home or launch workspace".to_string());
    }
    Ok(Some(path.to_string_lossy().into_owned()))
}

fn spawn_remote_terminal(cwd: Option<String>) -> Result<Arc<RemoteTerminal>, String> {
    let size = portable_pty::PtySize {
        rows: 40,
        cols: 120,
        pixel_width: 0,
        pixel_height: 0,
    };
    let pair = portable_pty::native_pty_system()
        .openpty(size)
        .map_err(|e| e.to_string())?;
    let mut child = pair
        .slave
        .spawn_command(build_remote_shell_command(cwd.clone())?)
        .map_err(|e| e.to_string())?;
    drop(pair.slave);
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = Arc::new(Mutex::new(
        pair.master.take_writer().map_err(|e| e.to_string())?,
    ));
    let session = Arc::new(RemoteTerminal {
        cwd: cwd.clone(),
        writer: Arc::clone(&writer),
        master: Mutex::new(pair.master),
        killer: Mutex::new(child.clone_killer()),
        output: Mutex::new(RemoteOutput {
            next_seq: 1,
            chunks: VecDeque::new(),
            exited: false,
        }),
        changed: Condvar::new(),
    });
    let output_session = Arc::clone(&session);
    thread::spawn(move || {
        let mut buf = [0_u8; 16 * 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(size) => {
                    let mut output = output_session.output.lock().unwrap();
                    let seq = output.next_seq;
                    output.next_seq = output.next_seq.saturating_add(1);
                    output.chunks.push_back((seq, buf[..size].to_vec()));
                    while output.chunks.len() > REMOTE_OUTPUT_LIMIT {
                        output.chunks.pop_front();
                    }
                    output_session.changed.notify_all();
                }
            }
        }
        let mut output = output_session.output.lock().unwrap();
        output.exited = true;
        output_session.changed.notify_all();
    });
    let wait_session = Arc::clone(&session);
    thread::spawn(move || {
        let _ = child.wait();
        let mut output = wait_session.output.lock().unwrap();
        output.exited = true;
        wait_session.changed.notify_all();
    });
    Ok(session)
}

/// Remote sessions deliberately use the user's normal login shell instead of
/// cmdSpace's desktop shell integration. The desktop integration emits OSC
/// markers for the local pane parser; forwarding those markers to a browser
/// terminal can corrupt the visible prompt on mobile renderers.
fn build_remote_shell_command(cwd: Option<String>) -> Result<portable_pty::CommandBuilder, String> {
    #[cfg(unix)]
    {
        let shell = std::env::var("SHELL")
            .ok()
            .filter(|path| std::path::Path::new(path).is_file())
            .unwrap_or_else(|| "/bin/zsh".to_string());
        let mut command = portable_pty::CommandBuilder::new(shell);
        command.arg("-l");
        command.arg("-i");
        command.env("TERM", "xterm-256color");
        command.env("COLORTERM", "truecolor");
        command.env_remove("CMDSPACE_TERMINAL");
        command.env_remove("CMDSPACE_USER_ZDOTDIR");
        command.env_remove("ZDOTDIR");
        if let Some(cwd) = cwd {
            command.cwd(cwd);
        }
        Ok(command)
    }
    #[cfg(windows)]
    {
        shell_init::build_command(cwd, WorkspaceEnv::default())
    }
}

fn remote_folders_response(path: &str) -> Result<String, String> {
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct FolderEntry {
        name: String,
        path: String,
    }
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct FileEntry {
        name: String,
        path: String,
        parent: String,
    }
    let requested = query_value(path, "path")
        .map(percent_decode)
        .transpose()?
        .filter(|value| !value.trim().is_empty())
        .or_else(|| dirs::home_dir().map(|path| path.to_string_lossy().into_owned()))
        .ok_or_else(|| "home directory is unavailable".to_string())?;
    let current = authorize_remote_cwd(Some(&requested))?
        .ok_or_else(|| "folder is unavailable".to_string())?;
    let current_path = PathBuf::from(&current);
    let entries =
        fs::read_dir(&current_path).map_err(|error| format!("cannot read folder: {error}"))?;
    let mut folders = Vec::new();
    let mut files = Vec::new();
    for entry in entries.filter_map(Result::ok) {
        let Some(file_type) = entry.file_type().ok() else {
            continue;
        };
        if file_type.is_dir() {
            let Some(folder_path) = authorize_remote_cwd(entry.path().to_str()).ok().flatten()
            else {
                continue;
            };
            folders.push(FolderEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: folder_path,
            });
        } else if file_type.is_file() {
            let Some(file_path) = fs::canonicalize(entry.path()).ok() else {
                continue;
            };
            files.push(FileEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: file_path.to_string_lossy().into_owned(),
                parent: current.clone(),
            });
        }
    }
    folders.sort_by_key(|entry| entry.name.to_lowercase());
    files.sort_by_key(|entry| entry.name.to_lowercase());
    let parent = current_path
        .parent()
        .filter(|parent| authorize_remote_cwd(parent.to_str()).is_ok())
        .map(|parent| parent.to_string_lossy().into_owned());
    serde_json::to_string(&serde_json::json!({
        "current": current,
        "parent": parent,
        "folders": folders,
        "files": files,
    }))
    .map_err(|error| error.to_string())
}

fn stream_remote_events(
    stream: &mut TcpStream,
    runtime: &Arc<Mutex<RemoteRuntime>>,
    id: u64,
    after: u64,
) {
    let session = runtime
        .lock()
        .ok()
        .and_then(|guard| guard.sessions.get(&id).cloned());
    let Some(session) = session else {
        write_text_response(
            stream,
            "404 Not Found",
            "application/json",
            "{\"error\":\"session not found\"}",
        );
        return;
    };
    let _ = stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: keep-alive\r\n\r\n");
    let mut cursor = after;
    loop {
        let mut output = session.output.lock().unwrap();
        while !output.chunks.iter().any(|(seq, _)| *seq > cursor) && !output.exited {
            let (next, timeout) = session
                .changed
                .wait_timeout(output, Duration::from_secs(15))
                .unwrap();
            output = next;
            if timeout.timed_out() {
                let _ = stream.write_all(b": heartbeat\n\n");
                let _ = stream.flush();
            }
        }
        let chunks: Vec<_> = output
            .chunks
            .iter()
            .filter(|(seq, _)| *seq > cursor)
            .cloned()
            .collect();
        let exited = output.exited;
        drop(output);
        for (seq, bytes) in chunks {
            cursor = seq;
            let hex = bytes
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect::<String>();
            if write!(stream, "id: {seq}\ndata: {hex}\n\n")
                .and_then(|_| stream.flush())
                .is_err()
            {
                return;
            }
        }
        if exited {
            let _ = stream.write_all(b"event: exit\ndata: {}\n\n");
            let _ = stream.flush();
            return;
        }
    }
}

fn stream_pty_events(stream: &mut TcpStream, pty_state: &PtyState, id: u64) {
    let Ok(desktop_id) = desktop_session_id(id) else {
        return;
    };
    let Ok((receiver, replay)) = pty_state.subscribe_output(desktop_id) else {
        write_text_response(
            stream,
            "404 Not Found",
            "application/json",
            "{\"error\":\"desktop session not found\"}",
        );
        return;
    };
    let _ = stream.write_all(
        b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: keep-alive\r\n\r\n",
    );
    for (sequence, bytes) in replay {
        let hex = bytes
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        if write!(stream, "id: {sequence}\ndata: {hex}\n\n")
            .and_then(|_| stream.flush())
            .is_err()
        {
            return;
        }
    }
    loop {
        match receiver.recv_timeout(Duration::from_secs(15)) {
            Ok((sequence, bytes)) => {
                let hex = bytes
                    .iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect::<String>();
                if write!(stream, "id: {sequence}\ndata: {hex}\n\n")
                    .and_then(|_| stream.flush())
                    .is_err()
                {
                    return;
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                if stream
                    .write_all(b": heartbeat\n\n")
                    .and_then(|_| stream.flush())
                    .is_err()
                {
                    return;
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                let _ = stream.write_all(b"event: exit\ndata: {}\n\n");
                let _ = stream.flush();
                return;
            }
        }
    }
}

fn pty_snapshot_response(pty_state: &PtyState, id: u64) -> Result<String, String> {
    let bytes = pty_state.output_snapshot(desktop_session_id(id)?)?;
    let mut output = String::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        let byte = bytes[index];
        if byte == 0x1b {
            index += 1;
            if index < bytes.len() && bytes[index] == b'[' {
                index += 1;
                while index < bytes.len() {
                    let final_byte = bytes[index];
                    index += 1;
                    if (0x40..=0x7e).contains(&final_byte) {
                        break;
                    }
                }
            } else if index < bytes.len() && bytes[index] == b']' {
                index += 1;
                while index < bytes.len() {
                    let control = bytes[index];
                    index += 1;
                    if control == 0x07 {
                        break;
                    }
                    if control == 0x1b && index < bytes.len() && bytes[index] == b'\\' {
                        index += 1;
                        break;
                    }
                }
            } else {
                index = index.saturating_add(1);
            }
            continue;
        }
        match byte {
            b'\n' => output.push('\n'),
            b'\r' => output.push('\n'),
            b'\t' => output.push('\t'),
            0x20..=0x7e => output.push(byte as char),
            _ => {}
        }
        index += 1;
    }
    serde_json::to_string(&serde_json::json!({ "output": output }))
        .map_err(|error| error.to_string())
}

fn session_from_runtime(
    runtime: &Arc<Mutex<RemoteRuntime>>,
    id: u64,
) -> Result<Arc<RemoteTerminal>, String> {
    runtime
        .lock()
        .map_err(|_| "remote runtime poisoned".to_string())?
        .sessions
        .get(&id)
        .cloned()
        .ok_or_else(|| "session not found".to_string())
}

fn remote_session_input(
    request: &[u8],
    runtime: &Arc<Mutex<RemoteRuntime>>,
    pty_state: &PtyState,
    id: u64,
) -> Result<(), String> {
    #[derive(serde::Deserialize)]
    struct Input {
        data: String,
    }
    let input: Input = serde_json::from_str(request_body(request)).map_err(|e| e.to_string())?;
    if let Ok(session) = session_from_runtime(runtime, id) {
        let result = session
            .writer
            .lock()
            .map_err(|_| "writer poisoned".to_string())?
            .write_all(input.data.as_bytes())
            .map_err(|e| e.to_string());
        return result;
    }
    pty_state.write_remote(desktop_session_id(id)?, &input.data)
}

fn remote_session_resize(
    request: &[u8],
    runtime: &Arc<Mutex<RemoteRuntime>>,
    pty_state: &PtyState,
    id: u64,
) -> Result<(), String> {
    #[derive(serde::Deserialize)]
    struct Input {
        cols: u16,
        rows: u16,
    }
    let input: Input = serde_json::from_str(request_body(request)).map_err(|e| e.to_string())?;
    if input.cols == 0 || input.rows == 0 {
        return Err("terminal size must be positive".to_string());
    }
    if let Ok(session) = session_from_runtime(runtime, id) {
        return session
            .master
            .lock()
            .map_err(|_| "master poisoned".to_string())?
            .resize(portable_pty::PtySize {
                cols: input.cols.min(400),
                rows: input.rows.min(200),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string());
    }
    // A desktop PTY is shared with the native terminal. Letting a phone
    // resize it would change the desktop's wrapping width and make the local
    // pane look empty on the right. The desktop owns dimensions for attached
    // sessions; remote-created sessions still use the requested size above.
    pty_state.restore_desktop_size(desktop_session_id(id)?)
}

fn close_remote_session(runtime: &Arc<Mutex<RemoteRuntime>>, id: u64) {
    if let Ok(mut guard) = runtime.lock() {
        if let Some(session) = guard.sessions.remove(&id) {
            let _ = session.killer.lock().map(|mut killer| killer.kill());
        }
    }
}

fn request_path(request: &[u8]) -> Option<&str> {
    let request = std::str::from_utf8(request).ok()?;
    let first_line = request.lines().next()?;
    first_line.split_whitespace().nth(1)
}

fn remote_dist_dir() -> PathBuf {
    let cwd = match std::env::current_dir() {
        Ok(cwd) => cwd,
        Err(_) => return PathBuf::from("dist"),
    };

    let direct = cwd.join("dist");
    if direct.exists() {
        return direct;
    }

    if let Some(parent) = cwd.parent() {
        let sibling = parent.join("dist");
        if sibling.exists() {
            return sibling;
        }
    }

    direct
}

fn remote_asset_response(path: &str, dist_dir: &Path) -> Result<RemoteResponse, String> {
    let asset_path = remote_asset_path(path, dist_dir)?;
    let body = fs::read(&asset_path)
        .map_err(|e| format!("remote UI asset missing: {} ({e})", asset_path.display()))?;
    Ok(RemoteResponse {
        status: "200 OK",
        content_type: content_type_for_path(&asset_path),
        body,
    })
}

fn remote_asset_path(path: &str, dist_dir: &Path) -> Result<PathBuf, String> {
    let clean_path = path.split('?').next().unwrap_or("/");
    let clean_path = clean_path.split('#').next().unwrap_or(clean_path);

    if clean_path
        .split('/')
        .any(|segment| segment == ".." || segment.contains('\\'))
    {
        return Err("remote UI asset path is invalid".to_string());
    }

    let relative = clean_path.trim_start_matches('/');
    let candidate = if relative.is_empty() || relative == "index.html" {
        dist_dir.join("remote.html")
    } else {
        dist_dir.join(relative)
    };

    if candidate.is_file() {
        return Ok(candidate);
    }

    let remote_html = dist_dir.join("remote.html");
    let can_spa_fallback = Path::new(relative)
        .extension()
        .and_then(|ext| ext.to_str())
        .is_none();
    if can_spa_fallback && remote_html.is_file() {
        return Ok(remote_html);
    }

    Ok(candidate)
}

fn content_type_for_path(path: &Path) -> &'static str {
    match path.extension().and_then(|ext| ext.to_str()).unwrap_or("") {
        "css" => "text/css; charset=utf-8",
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
}

fn remote_state_response() -> Result<RemoteResponse, String> {
    let conn = db::init_db()?;
    let workspaces = db::list_workspaces_inner(&conn)?;
    let recent_workspaces = db::list_recent_workspaces_inner(&conn)?;
    let body = serde_json::to_vec(&RemoteUiState {
        workspaces,
        recent_workspaces,
    })
    .map_err(|e| format!("remote UI state serialization failed: {e}"))?;

    Ok(RemoteResponse {
        status: "200 OK",
        content_type: "application/json; charset=utf-8",
        body,
    })
}

fn remote_json_error_response(error: &str) -> RemoteResponse {
    let body = serde_json::json!({ "error": error }).to_string();
    RemoteResponse {
        status: "500 Internal Server Error",
        content_type: "application/json; charset=utf-8",
        body: body.into_bytes(),
    }
}

fn remote_fallback_response(reason: &str) -> RemoteResponse {
    let escaped_reason = html_escape(reason);
    let body = format!(
        r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>cmdSpace Remote</title>
  <style>
    :root {{ color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    body {{ margin: 0; min-height: 100dvh; display: grid; place-items: center; background: #0a0b0d; color: #f8fafc; }}
    main {{ width: min(92vw, 720px); border: 1px solid rgba(148,163,184,.22); border-radius: 18px; background: #17181c; padding: 28px; box-shadow: 0 24px 80px rgba(0,0,0,.45); }}
    h1 {{ margin: 0 0 12px; font-size: clamp(28px, 8vw, 64px); line-height: .95; letter-spacing: 0; }}
    p {{ margin: 0; color: #a8b1bd; font-size: 16px; line-height: 1.65; }}
    code {{ color: #e5e7eb; background: #272a31; border-radius: 6px; padding: 2px 6px; }}
  </style>
</head>
<body>
  <main>
    <p>REMOTE ACCESS IS ON</p>
    <h1>Remote UI bundle is not built</h1>
    <p>cmdSpace is reachable on this network, but <code>dist/remote.html</code> is missing. Run <code>pnpm build</code> once, then restart cmdSpace remote access.</p>
    <p><code>{escaped_reason}</code></p>
  </main>
</body>
</html>"#
    );
    RemoteResponse {
        status: "200 OK",
        content_type: "text/html; charset=utf-8",
        body: body.into_bytes(),
    }
}

fn html_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn prepare_client_stream(stream: &TcpStream) -> std::io::Result<()> {
    stream.set_nonblocking(false)?;
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    stream.set_write_timeout(Some(Duration::from_secs(10)))?;
    Ok(())
}

fn read_http_request(stream: &mut TcpStream) -> std::io::Result<Vec<u8>> {
    let mut request = Vec::with_capacity(4096);
    let mut buf = [0_u8; 4096];
    loop {
        let n = stream.read(&mut buf)?;
        if n == 0 {
            break;
        }
        request.extend_from_slice(&buf[..n]);
        let Some(header_end) = request.windows(4).position(|w| w == b"\r\n\r\n") else {
            if request.len() > 64 * 1024 {
                break;
            }
            continue;
        };
        let header_len = header_end + 4;
        let content_length = std::str::from_utf8(&request[..header_end])
            .ok()
            .and_then(|headers| {
                headers.lines().find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    name.eq_ignore_ascii_case("content-length")
                        .then(|| value.trim().parse::<usize>().ok())
                        .flatten()
                })
            })
            .unwrap_or(0);
        if request.len() >= header_len.saturating_add(content_length) || request.len() > 64 * 1024 {
            break;
        }
    }
    Ok(request)
}

fn is_idle_client_read_error(error: &std::io::Error) -> bool {
    matches!(
        error.kind(),
        std::io::ErrorKind::WouldBlock
            | std::io::ErrorKind::TimedOut
            | std::io::ErrorKind::Interrupted
    )
}

fn write_text_response(stream: &mut TcpStream, status: &str, content_type: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len(),
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn write_binary_response(stream: &mut TcpStream, response: &RemoteResponse) {
    let headers = format!(
        "HTTP/1.1 {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        response.status,
        response.content_type,
        response.body.len(),
    );
    let _ = stream.write_all(headers.as_bytes());
    let _ = stream.write_all(&response.body);
    let _ = stream.flush();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn remote_client_stream_reads_delayed_request_after_nonblocking_accept() {
        let listener = TcpListener::bind((IpAddr::from([127, 0, 0, 1]), 0)).unwrap();
        listener.set_nonblocking(true).unwrap();
        let addr = listener.local_addr().unwrap();

        let writer = thread::spawn(move || {
            let mut client = TcpStream::connect(addr).unwrap();
            thread::sleep(Duration::from_millis(75));
            client
                .write_all(b"GET / HTTP/1.1\r\nHost: localhost\r\n\r\n")
                .unwrap();
        });

        let start = Instant::now();
        let mut accepted = loop {
            match listener.accept() {
                Ok((stream, _)) => break stream,
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    if start.elapsed() > Duration::from_secs(2) {
                        panic!("timed out waiting for test client");
                    }
                    thread::sleep(Duration::from_millis(10));
                }
                Err(e) => panic!("accept failed: {e}"),
            }
        };

        prepare_client_stream(&accepted).unwrap();
        let request = read_http_request(&mut accepted).unwrap();
        writer.join().unwrap();

        assert!(request.starts_with(b"GET / HTTP/1.1\r\n"));
        assert!(request.ends_with(b"\r\n\r\n"));
    }

    #[test]
    fn remote_asset_response_serves_react_bundle_from_dist() {
        let dir = tempfile::tempdir().unwrap();
        let assets = dir.path().join("assets");
        fs::create_dir(&assets).unwrap();
        fs::write(
            dir.path().join("remote.html"),
            r#"<!doctype html><div id="remote-root"></div><script src="/assets/remote.js"></script>"#,
        )
        .unwrap();
        fs::write(assets.join("remote.js"), "console.log('remote bundle')").unwrap();

        let html = remote_asset_response("/", dir.path()).unwrap();
        assert_eq!(html.content_type, "text/html; charset=utf-8");
        assert!(String::from_utf8(html.body)
            .unwrap()
            .contains("remote-root"));

        let js = remote_asset_response("/assets/remote.js", dir.path()).unwrap();
        assert_eq!(js.content_type, "text/javascript; charset=utf-8");
        assert!(String::from_utf8(js.body)
            .unwrap()
            .contains("remote bundle"));
    }

    #[test]
    fn remote_asset_response_rejects_path_traversal() {
        let dir = tempfile::tempdir().unwrap();
        let error = remote_asset_response("/../Cargo.toml", dir.path()).unwrap_err();

        assert!(error.contains("invalid"));
    }

    #[test]
    fn remote_fallback_response_explains_missing_bundle() {
        let response = remote_fallback_response("missing <remote>");
        let body = String::from_utf8(response.body).unwrap();

        assert_eq!(response.content_type, "text/html; charset=utf-8");
        assert!(body.contains("Remote UI bundle is not built"));
        assert!(body.contains("missing &lt;remote&gt;"));
    }

    #[test]
    fn remote_health_endpoint_returns_json() {
        let remote_listener = TcpListener::bind((IpAddr::from([127, 0, 0, 1]), 0)).unwrap();
        remote_listener.set_nonblocking(true).unwrap();
        let remote_addr = remote_listener.local_addr().unwrap();
        let client_thread = thread::spawn(move || {
            let mut client = TcpStream::connect(remote_addr).unwrap();
            client
                .write_all(b"GET /healthz HTTP/1.1\r\nHost: remote\r\n\r\n")
                .unwrap();
            let mut response = String::new();
            client.read_to_string(&mut response).unwrap();
            response
        });

        let start = Instant::now();
        let mut accepted = loop {
            match remote_listener.accept() {
                Ok((stream, _)) => break stream,
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    if start.elapsed() > Duration::from_secs(2) {
                        panic!("timed out waiting for remote health test client");
                    }
                    thread::sleep(Duration::from_millis(10));
                }
                Err(e) => panic!("accept failed: {e}"),
            }
        };

        handle_connection(
            &mut accepted,
            Arc::new(AtomicBool::new(false)),
            Arc::new(Mutex::new(RemoteRuntime {
                id: 1,
                next_id: 1,
                sessions: HashMap::new(),
            })),
            PtyState::default(),
            Arc::new(Mutex::new(RemoteAuth::new().unwrap().0)),
            Arc::new(std::env::temp_dir().join("cmdspace-remote-health-password.txt")),
        );
        drop(accepted);
        let response = client_thread.join().unwrap();

        assert!(response.starts_with("HTTP/1.1 200 OK\r\n"));
        assert!(response.contains("\"ok\":true"));
        assert!(response.contains("cmdspace-remote"));
    }

    #[test]
    fn remote_http_reader_keeps_json_body_after_headers() {
        let listener = TcpListener::bind((IpAddr::from([127, 0, 0, 1]), 0)).unwrap();
        let address = listener.local_addr().unwrap();
        let writer = thread::spawn(move || {
            let mut client = TcpStream::connect(address).unwrap();
            client
                .write_all(b"POST /api/remote/session/1/input HTTP/1.1\r\nContent-Length: 12\r\n\r\n{\"data\":\"x\"}")
                .unwrap();
        });
        let (mut client, _) = listener.accept().unwrap();
        let request = read_http_request(&mut client).unwrap();
        writer.join().unwrap();
        assert!(String::from_utf8(request)
            .unwrap()
            .ends_with("{\"data\":\"x\"}"));
    }

    #[test]
    fn remote_session_paths_keep_query_parameters_separate() {
        let path = "/api/remote/session/42/events?after=7&token=secret";
        assert_eq!(
            path.split('?').next(),
            Some("/api/remote/session/42/events")
        );
        assert_eq!(
            remote_session_id(path.split('?').next().unwrap(), "/events"),
            Some(42)
        );
        assert_eq!(query_number(path, "after"), Some(7));
    }

    #[test]
    fn remote_state_response_returns_workspace_rows() {
        let conn = db::init_db().unwrap();
        conn.execute("DELETE FROM workspaces", []).unwrap();
        conn.execute("DELETE FROM recent_workspaces", []).unwrap();
        db::save_workspace_inner(
            &conn,
            &db::WorkspaceRow {
                id: "workspace-remote".to_string(),
                name: "Remote Workspace".to_string(),
                count: 4,
                accent_color: Some("#10B981".to_string()),
                working_folder: Some("/Users/0xboji/dev/app/terax-ai".to_string()),
                created_at: 1,
                updated_at: 2,
                display_order: 0,
                pane_layout: None,
                workspace_mode: Some("canvas".to_string()),
            },
        )
        .unwrap();
        db::save_recent_workspace_inner(
            &conn,
            &db::RecentWorkspaceRow {
                id: "recent-remote".to_string(),
                name: "Recent Remote".to_string(),
                count: 2,
                working_folder: "/Users/0xboji/dev".to_string(),
                updated_at: 3,
            },
        )
        .unwrap();
        drop(conn);

        let response = remote_state_response().unwrap();
        let body = String::from_utf8(response.body).unwrap();

        assert_eq!(response.status, "200 OK");
        assert_eq!(response.content_type, "application/json; charset=utf-8");
        assert!(body.contains("\"workspaces\""));
        assert!(body.contains("\"recentWorkspaces\""));
        assert!(body.contains("\"Remote Workspace\""));
        assert!(body.contains("\"accentColor\":\"#10B981\""));
    }

    #[test]
    fn websocket_upgrade_request_requires_remote_gateway_path_and_headers() {
        let request = b"GET /api/remote/ws HTTP/1.1\r\nHost: localhost\r\nConnection: keep-alive, Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n";

        assert!(is_remote_websocket_upgrade(request));
        assert!(!is_remote_websocket_upgrade(
            b"GET /api/remote/ws HTTP/1.1\r\nHost: localhost\r\n\r\n"
        ));
        assert!(!is_remote_websocket_upgrade(
            b"GET /api/remote/state HTTP/1.1\r\nUpgrade: websocket\r\nSec-WebSocket-Key: key\r\n\r\n"
        ));
    }

    #[test]
    fn websocket_upgrade_rejects_a_cross_origin_browser_request() {
        let request = b"GET /api/remote/ws HTTP/1.1\r\nHost: 192.168.1.8:53631\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: key\r\nOrigin: https://attacker.example\r\n\r\n";

        assert!(!is_remote_websocket_origin_allowed(request));
    }

    #[test]
    fn remote_runtime_session_ids_do_not_overlap_desktop_pty_ids() {
        assert!(REMOTE_SESSION_ID_START > u32::MAX as u64);
        assert_eq!(desktop_session_id(u32::MAX as u64), Ok(u32::MAX));
        assert!(desktop_session_id(REMOTE_SESSION_ID_START).is_err());
    }

    #[test]
    fn remote_websocket_session_list_excludes_desktop_ptys() {
        let source = include_str!("remote.rs");
        let start = source
            .find("fn send_remote_sessions(")
            .expect("remote session list function");
        let end = source[start..]
            .find("fn drain_remote_websocket_output(")
            .map(|offset| start + offset)
            .expect("next remote websocket function");

        assert!(
            !source[start..end].contains(".list_sessions()"),
            "the remote UI must never attach a desktop terminal by matching its cwd"
        );
    }

    #[test]
    fn remote_websocket_commands_only_target_remote_runtime_sessions() {
        let source = include_str!("remote.rs");
        let start = source
            .find("fn handle_remote_websocket_message(")
            .expect("remote WebSocket command handler");
        let end = source[start..]
            .find("fn send_remote_sessions(")
            .map(|offset| start + offset)
            .expect("remote session list function");
        let handler = &source[start..end];

        assert!(
            !handler.contains("desktop_session_id"),
            "remote WebSocket commands must not fall back to desktop PTYs"
        );
        assert!(
            !handler.contains("pty_state."),
            "remote WebSocket commands must only use their own runtime PTYs"
        );
    }

    #[test]
    fn remote_terminal_spawns_in_an_authorized_directory() {
        let cwd = dirs::home_dir()
            .expect("home directory")
            .to_string_lossy()
            .into_owned();
        let terminal = spawn_remote_terminal(Some(cwd)).expect("remote terminal should spawn");

        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        let mut output = terminal.output.lock().expect("remote terminal output");
        while output.chunks.is_empty() && !output.exited && std::time::Instant::now() < deadline {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            let (next, _) = terminal
                .changed
                .wait_timeout(output, remaining)
                .expect("wait for remote terminal output");
            output = next;
        }
        assert!(
            !output.chunks.is_empty(),
            "remote shell should publish its initial prompt"
        );
        drop(output);

        terminal
            .killer
            .lock()
            .expect("remote terminal killer")
            .kill()
            .expect("remote terminal should stop");
    }

    #[cfg(unix)]
    #[test]
    fn remote_shell_is_a_clean_login_shell_without_desktop_integration() {
        let cwd = dirs::home_dir()
            .expect("home directory")
            .to_string_lossy()
            .into_owned();
        let command =
            build_remote_shell_command(Some(cwd.clone())).expect("remote command should build");

        assert!(command.get_argv().iter().any(|arg| arg == "-l"));
        assert!(command.get_argv().iter().any(|arg| arg == "-i"));
        assert_eq!(
            command.get_cwd().map(|path| path.to_string_lossy()),
            Some(cwd.into())
        );
        assert_eq!(command.get_env("CMDSPACE_TERMINAL"), None);
        assert_eq!(command.get_env("CMDSPACE_USER_ZDOTDIR"), None);
        assert_eq!(command.get_env("ZDOTDIR"), None);
    }

    #[test]
    fn remote_terminal_writes_input_and_emits_the_shell_response() {
        let cwd = dirs::home_dir()
            .expect("home directory")
            .to_string_lossy()
            .into_owned();
        let terminal = spawn_remote_terminal(Some(cwd)).expect("remote terminal should spawn");

        terminal
            .writer
            .lock()
            .expect("remote terminal writer")
            .write_all(b"printf 'cmdspace-direct-input-ok\\n'\\r")
            .expect("remote terminal should receive input");

        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        let mut output = terminal.output.lock().expect("remote terminal output");
        while !output
            .chunks
            .iter()
            .any(|(_, bytes)| String::from_utf8_lossy(bytes).contains("cmdspace-direct-input-ok"))
            && !output.exited
            && std::time::Instant::now() < deadline
        {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            let (next, _) = terminal
                .changed
                .wait_timeout(output, remaining)
                .expect("wait for remote terminal output");
            output = next;
        }
        assert!(
            output
                .chunks
                .iter()
                .any(|(_, bytes)| String::from_utf8_lossy(bytes)
                    .contains("cmdspace-direct-input-ok")),
            "remote terminal input should be returned through its PTY"
        );
        drop(output);

        terminal
            .killer
            .lock()
            .expect("remote terminal killer")
            .kill()
            .expect("remote terminal should stop");
    }

    #[test]
    fn remote_websocket_creates_attaches_and_streams_a_terminal_prompt() {
        let listener = TcpListener::bind((IpAddr::from([127, 0, 0, 1]), 0)).unwrap();
        let address = listener.local_addr().unwrap();
        let now = now_unix_seconds();
        let (mut remote_auth, bootstrap) = RemoteAuth::new().unwrap();
        remote_auth
            .setup_password(&bootstrap, "remote-test-password", now)
            .unwrap();
        let token = remote_auth
            .authenticate_password("remote-test-password", "test-client", now)
            .unwrap();
        let runtime = Arc::new(Mutex::new(RemoteRuntime {
            id: 1,
            next_id: REMOTE_SESSION_ID_START,
            sessions: HashMap::new(),
        }));
        let server_runtime = Arc::clone(&runtime);
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            handle_connection(
                &mut stream,
                Arc::new(AtomicBool::new(false)),
                server_runtime,
                PtyState::default(),
                Arc::new(Mutex::new(remote_auth)),
                Arc::new(std::env::temp_dir().join("cmdspace-remote-ws-test-password")),
            );
        });

        let stream = TcpStream::connect(address).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let (mut socket, _) =
            tungstenite::client(format!("ws://{address}/api/remote/ws"), stream).unwrap();
        let read_message = |socket: &mut WebSocket<TcpStream>| {
            let message = socket.read().expect("remote WebSocket message");
            let Message::Text(payload) = message else {
                panic!("expected a text WebSocket message");
            };
            serde_json::from_str::<RemoteServerEnvelope>(payload.as_ref()).unwrap()
        };
        let send_message = |socket: &mut WebSocket<TcpStream>, message| {
            let payload = serde_json::to_string(&RemoteClientEnvelope::new(message)).unwrap();
            socket.send(Message::text(payload)).unwrap();
        };

        assert!(matches!(
            read_message(&mut socket).message,
            ServerMessage::Hello { .. }
        ));
        send_message(&mut socket, ClientMessage::Auth { token });
        assert_eq!(
            read_message(&mut socket).message,
            ServerMessage::Authenticated
        );
        let cwd = dirs::home_dir()
            .expect("home directory")
            .to_string_lossy()
            .into_owned();
        send_message(&mut socket, ClientMessage::CreateSession { cwd: Some(cwd) });
        let ServerMessage::Sessions { sessions } = read_message(&mut socket).message else {
            panic!("expected the created remote session");
        };
        let session_id = sessions
            .into_iter()
            .find(|session| session.id >= REMOTE_SESSION_ID_START)
            .expect("runtime remote session")
            .id;
        send_message(
            &mut socket,
            ClientMessage::CreateSession {
                cwd: dirs::home_dir().map(|path| path.to_string_lossy().into_owned()),
            },
        );
        let ServerMessage::Sessions { sessions } = read_message(&mut socket).message else {
            panic!("expected sessions after duplicate create");
        };
        assert_eq!(
            sessions
                .iter()
                .filter(|session| session.id >= REMOTE_SESSION_ID_START)
                .count(),
            1,
            "retries must not spawn duplicate remote shells",
        );
        send_message(
            &mut socket,
            ClientMessage::Attach {
                session_id,
                after: 0,
            },
        );
        let mut visible_output = String::new();
        let prompt_deadline = std::time::Instant::now() + Duration::from_secs(3);
        while std::time::Instant::now() < prompt_deadline {
            let output = read_message(&mut socket).message;
            match output {
                ServerMessage::Snapshot { data, .. } | ServerMessage::Output { data, .. } => {
                    visible_output.push_str(&data);
                }
                _ => {}
            }
            if visible_output.contains("\u{1b}[K") {
                break;
            }
        }
        assert!(visible_output.contains("\u{1b}[K"), "visible shell prompt");

        send_message(
            &mut socket,
            ClientMessage::Input {
                session_id,
                data: "printf 'cmdspace-remote-input-ok\\n'\\r".to_string(),
            },
        );
        let input_deadline = std::time::Instant::now() + Duration::from_secs(3);
        while std::time::Instant::now() < input_deadline {
            let output = read_message(&mut socket).message;
            match output {
                ServerMessage::Output { data, .. } => visible_output.push_str(&data),
                ServerMessage::Error { message, .. } => {
                    visible_output.push_str("[remote error: ");
                    visible_output.push_str(&message);
                    visible_output.push(']');
                }
                _ => {}
            }
            if visible_output.contains("cmdspace-remote-input-ok") {
                break;
            }
        }
        assert!(
            visible_output.contains("cmdspace-remote-input-ok"),
            "remote keyboard input should reach its isolated shell; received: {visible_output:?}"
        );

        socket.close(None).unwrap();
        server.join().unwrap();
        close_remote_session(&runtime, session_id);
    }

    #[test]
    fn remote_status_prefers_a_ready_public_url_and_keeps_lan_fallback() {
        let tunnel = super::super::remote_tunnel::TunnelSnapshot {
            state: super::super::remote_tunnel::TunnelState::Ready,
            public_url: Some("https://remote-test.lhr.life".to_string()),
            error: None,
        };

        let status = status_with_tunnel(true, 53_631, Some("pair-once".to_string()), Some(tunnel));

        assert_eq!(status.url, "https://remote-test.lhr.life");
        assert!(status.lan_url.starts_with("http://"));
        assert_eq!(status.public_url.as_deref(), Some(status.url.as_str()));
        assert_eq!(
            status.tunnel_state,
            super::super::remote_tunnel::TunnelState::Ready
        );
        assert_eq!(status.bootstrap_secret.as_deref(), Some("pair-once"));
    }

    #[test]
    fn remote_status_uses_lan_while_the_tunnel_is_degraded() {
        let tunnel = super::super::remote_tunnel::TunnelSnapshot {
            state: super::super::remote_tunnel::TunnelState::Degraded,
            public_url: None,
            error: Some("provider disconnected".to_string()),
        };

        let status = status_with_tunnel(true, 53_631, None, Some(tunnel));

        assert_eq!(status.url, status.lan_url);
        assert_eq!(status.public_url, None);
        assert_eq!(
            status.tunnel_error.as_deref(),
            Some("provider disconnected")
        );
    }

    #[test]
    fn running_remote_status_hides_the_setup_link_after_password_creation() {
        let auth = Arc::new(Mutex::new(RemoteAuth::from_material(
            "auto-start-secret",
            [11_u8; 32],
            now_unix_seconds().saturating_add(300),
            3_600,
        )));
        let mut server = RemoteServer {
            shutdown: Arc::new(AtomicBool::new(false)),
            handle: None,
            listen_addr: SocketAddr::from(([127, 0, 0, 1], 53_631)),
            tunnel: None,
            tunnel_start_error: Some("test tunnel unavailable".to_string()),
            auth: Arc::clone(&auth),
            bootstrap_secret: Some("auto-start-secret".to_string()),
        };

        assert_eq!(
            server.status().bootstrap_secret.as_deref(),
            Some("auto-start-secret")
        );
        auth.lock()
            .unwrap()
            .setup_password(
                "auto-start-secret",
                "correct horse battery staple",
                now_unix_seconds(),
            )
            .unwrap();
        assert_eq!(server.status().bootstrap_secret, None);
    }

    #[test]
    fn running_remote_status_rotates_an_expired_setup_link() {
        let auth = Arc::new(Mutex::new(RemoteAuth::from_material(
            "expired-secret",
            [12_u8; 32],
            now_unix_seconds().saturating_sub(1),
            3_600,
        )));
        let mut server = RemoteServer {
            shutdown: Arc::new(AtomicBool::new(false)),
            handle: None,
            listen_addr: SocketAddr::from(([127, 0, 0, 1], 53_631)),
            tunnel: None,
            tunnel_start_error: Some("test tunnel unavailable".to_string()),
            auth: Arc::clone(&auth),
            bootstrap_secret: Some("expired-secret".to_string()),
        };

        let refreshed = server
            .status()
            .bootstrap_secret
            .expect("expired setup link should be refreshed");

        assert_ne!(refreshed, "expired-secret");
        assert!(auth
            .lock()
            .unwrap()
            .setup_password(&refreshed, "taotest123", now_unix_seconds())
            .is_ok());
    }

    #[test]
    fn lan_fallback_prefers_a_private_interface_without_an_internet_route() {
        let candidates = [
            IpAddr::from([0, 0, 0, 0]),
            IpAddr::from([127, 0, 0, 1]),
            IpAddr::from([169, 254, 4, 2]),
            IpAddr::from([192, 168, 50, 12]),
            IpAddr::from([10, 0, 0, 8]),
        ];

        assert_eq!(
            select_lan_ip(candidates),
            Some(IpAddr::from([192, 168, 50, 12]))
        );
    }

    #[test]
    fn remote_directory_response_lists_files_without_reading_contents() {
        let home = dirs::home_dir().expect("home directory");
        let root = tempfile::Builder::new()
            .prefix("cmdspace-remote-picker-")
            .tempdir_in(home)
            .expect("temporary remote picker directory");
        std::fs::create_dir(root.path().join("project-folder")).expect("create folder");
        std::fs::write(root.path().join("README.md"), "private contents").expect("create file");

        let response = remote_folders_response(&format!(
            "/api/remote/folders?path={}",
            root.path().display()
        ))
        .expect("directory response");
        let payload: serde_json::Value = serde_json::from_str(&response).expect("valid json");

        assert_eq!(payload["folders"][0]["name"], "project-folder");
        assert_eq!(payload["files"][0]["name"], "README.md");
        assert_eq!(
            payload["files"][0]["parent"],
            root.path().to_string_lossy().as_ref()
        );
        assert!(!response.contains("private contents"));
    }

    #[test]
    fn remote_directory_listing_scans_each_directory_once() {
        let source = include_str!("remote.rs");
        let listing = source
            .split_once("fn remote_folders_response")
            .unwrap()
            .1
            .split_once("fn stream_remote_events")
            .unwrap()
            .0;

        assert_eq!(listing.matches("fs::read_dir(&current_path)").count(), 1);
    }

    #[test]
    fn legacy_terminal_http_routes_are_retired() {
        assert!(is_legacy_remote_terminal_path("/api/remote/sessions"));
        assert!(is_legacy_remote_terminal_path(
            "/api/remote/runtime/sessions"
        ));
        assert!(is_legacy_remote_terminal_path("/api/remote/session"));
        assert!(is_legacy_remote_terminal_path(
            "/api/remote/session/42/input"
        ));
        assert!(!is_legacy_remote_terminal_path("/api/remote/state"));
        assert!(!is_legacy_remote_terminal_path("/api/remote/folders"));
    }

    #[test]
    fn bearer_token_is_read_from_the_authorization_header() {
        let request =
            b"GET /api/remote/state HTTP/1.1\r\nAuthorization: Bearer signed-token\r\n\r\n";

        assert_eq!(remote_bearer_token(request), Some("signed-token"));
    }

    #[test]
    fn exited_runtime_output_is_not_advertised_as_live() {
        let mut output = RemoteOutput {
            next_seq: 1,
            chunks: VecDeque::new(),
            exited: false,
        };
        assert!(runtime_output_is_live(&output));

        output.exited = true;
        assert!(!runtime_output_is_live(&output));
    }
}
