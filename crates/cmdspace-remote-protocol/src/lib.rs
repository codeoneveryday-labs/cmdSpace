//! Versioned messages shared by the desktop remote host and native mobile clients.
//!
//! This crate intentionally has no networking, terminal, or platform dependencies.

use serde::{de::DeserializeOwned, Deserialize, Deserializer, Serialize, Serializer};

pub const REMOTE_PROTOCOL_VERSION: u16 = 2;
pub const REMOTE_DEVICE_PROTOCOL_VERSION: u16 = 3;
pub const REMOTE_RELAY_PROTOCOL_VERSION: u16 = 1;

/// The relay only needs to know which socket role it is admitting. Native
/// device frames keep their existing v3 envelope once admission succeeds.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RemoteRelayRole {
    Desktop,
    Device,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteRelayAdmission {
    pub version: u16,
    pub role: RemoteRelayRole,
    pub relay_id: String,
    pub credential: String,
}

/// Control messages used only between the durable relay and its two peers.
/// Device payloads themselves remain the existing native v3 envelopes.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum RemoteRelayControlMessage {
    RelayReady {
        connection_id: Option<String>,
    },
    Heartbeat,
    HeartbeatAck,
    DesktopOffline,
    DeviceOpen {
        connection_id: String,
    },
    DeviceFrame {
        connection_id: String,
        payload: String,
    },
    DeviceClose {
        connection_id: String,
    },
}

#[derive(Default)]
pub struct Utf8StreamDecoder {
    pending: Vec<u8>,
}

impl Utf8StreamDecoder {
    pub fn push(&mut self, bytes: &[u8]) -> String {
        self.pending.extend_from_slice(bytes);
        let mut output = String::new();

        loop {
            match std::str::from_utf8(&self.pending) {
                Ok(valid) => {
                    output.push_str(valid);
                    self.pending.clear();
                    break;
                }
                Err(error) => {
                    let valid_up_to = error.valid_up_to();
                    if valid_up_to > 0 {
                        if let Ok(valid) = std::str::from_utf8(&self.pending[..valid_up_to]) {
                            output.push_str(valid);
                        }
                    }

                    if let Some(error_len) = error.error_len() {
                        output.push('\u{fffd}');
                        self.pending.drain(..valid_up_to + error_len);
                    } else {
                        self.pending.drain(..valid_up_to);
                        break;
                    }
                }
            }
        }

        output
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ClientMessage {
    Auth {
        token: String,
    },
    ListSessions,
    ListWorkspaces,
    /// Lists desktop folders eligible to become a mobile workspace directory.
    ListFolderPickerDirectory {
        path: Option<String>,
    },
    ListDirectory {
        #[serde(rename = "workspaceId")]
        workspace_id: String,
        path: Option<String>,
    },
    ReadFile {
        #[serde(rename = "workspaceId")]
        workspace_id: String,
        path: String,
    },
    CreateDirectory {
        #[serde(rename = "workspaceId")]
        workspace_id: String,
        path: String,
        name: String,
    },
    CreateSession {
        cwd: Option<String>,
        #[serde(rename = "workspaceId", default)]
        workspace_id: Option<String>,
    },
    CreateWorkspace {
        #[serde(rename = "workspaceId")]
        workspace_id: String,
        name: String,
        #[serde(rename = "workingFolder")]
        working_folder: String,
        #[serde(rename = "terminalCount")]
        terminal_count: u8,
    },
    ListImportableSessions {
        #[serde(rename = "workspaceId")]
        workspace_id: Option<String>,
        #[serde(rename = "workspaceOnly")]
        workspace_only: bool,
    },
    ImportSession {
        #[serde(rename = "workspaceId")]
        workspace_id: Option<String>,
        provider: String,
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    Attach {
        #[serde(rename = "sessionId")]
        session_id: u64,
        after: u64,
    },
    Detach {
        #[serde(rename = "sessionId")]
        session_id: u64,
    },
    Input {
        #[serde(rename = "sessionId")]
        session_id: u64,
        data: String,
    },
    Resize {
        #[serde(rename = "sessionId")]
        session_id: u64,
        cols: u16,
        rows: u16,
    },
    Close {
        #[serde(rename = "sessionId")]
        session_id: u64,
    },
    Ping,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerMessage {
    Hello {
        authenticated: bool,
        #[serde(rename = "runtimeId")]
        runtime_id: u64,
    },
    Authenticated,
    Sessions {
        sessions: Vec<RemoteProtocolSession>,
    },
    Workspaces {
        workspaces: Vec<RemoteProtocolWorkspace>,
    },
    ProvidersSnapshot {
        providers: Vec<RemoteProtocolProvider>,
    },
    /// A directory-only projection for the mobile workspace folder picker.
    FolderPickerDirectory {
        path: String,
        parent: Option<String>,
        entries: Vec<RemoteProtocolDirectoryEntry>,
    },
    Directory {
        path: String,
        entries: Vec<RemoteProtocolDirectoryEntry>,
    },
    FileContent {
        path: String,
        content: String,
    },
    ImportableSessions {
        sessions: Vec<RemoteProtocolImportableSession>,
    },
    Attached {
        #[serde(rename = "sessionId")]
        session_id: u64,
    },
    Snapshot {
        #[serde(rename = "sessionId")]
        session_id: u64,
        sequence: u64,
        data: String,
    },
    Output {
        #[serde(rename = "sessionId")]
        session_id: u64,
        sequence: u64,
        data: String,
    },
    Exit {
        #[serde(rename = "sessionId")]
        session_id: u64,
        code: Option<i32>,
    },
    Error {
        code: String,
        message: String,
        retryable: bool,
    },
    Pong,
}

/// Device-only messages. They deliberately use a separate v3 envelope so the
/// browser v2 protocol cannot accidentally interpret a native pairing request.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DeviceClientMessage {
    PairDevice {
        #[serde(rename = "grantSecret")]
        grant_secret: String,
        #[serde(rename = "deviceName")]
        device_name: String,
        #[serde(rename = "publicKey")]
        public_key: String,
        proof: String,
    },
    AuthenticateDevice {
        #[serde(rename = "deviceId")]
        device_id: String,
        proof: String,
    },
    Command {
        command: ClientMessage,
    },
    Ping,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DeviceServerMessage {
    PairingChallenge {
        challenge: String,
    },
    DeviceAuthenticated {
        #[serde(rename = "deviceId")]
        device_id: String,
    },
    SnapshotRequired {
        #[serde(rename = "sessionId")]
        session_id: u64,
    },
    Event {
        event: ServerMessage,
    },
    Error {
        code: String,
        message: String,
        retryable: bool,
    },
    Pong,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProtocolSession {
    pub id: u64,
    pub title: String,
    pub cwd: Option<String>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<String>,
    pub agent: Option<String>,
    pub attached: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProtocolWorkspace {
    pub id: String,
    pub name: String,
    pub working_folder: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProtocolProvider {
    pub id: String,
    pub name: String,
    pub executable: String,
    pub description: String,
    pub install_url: Option<String>,
    pub configured: bool,
    pub enabled: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProtocolDirectoryEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProtocolImportableSession {
    pub provider: String,
    pub session_id: String,
    pub cwd: String,
    pub title: String,
    pub preview: Option<String>,
    pub last_activity_at: u64,
    pub active: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RemoteClientEnvelope {
    pub version: u16,
    pub message: ClientMessage,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RemoteServerEnvelope {
    pub version: u16,
    pub message: ServerMessage,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RemoteDeviceClientEnvelope {
    pub version: u16,
    pub message: DeviceClientMessage,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RemoteDeviceServerEnvelope {
    pub version: u16,
    pub message: DeviceServerMessage,
}

impl RemoteClientEnvelope {
    pub fn new(message: ClientMessage) -> Self {
        Self {
            version: REMOTE_PROTOCOL_VERSION,
            message,
        }
    }
}

impl RemoteServerEnvelope {
    pub fn new(message: ServerMessage) -> Self {
        Self {
            version: REMOTE_PROTOCOL_VERSION,
            message,
        }
    }
}

impl RemoteDeviceClientEnvelope {
    pub fn new(message: DeviceClientMessage) -> Self {
        Self {
            version: REMOTE_DEVICE_PROTOCOL_VERSION,
            message,
        }
    }
}

impl RemoteDeviceServerEnvelope {
    pub fn new(message: DeviceServerMessage) -> Self {
        Self {
            version: REMOTE_DEVICE_PROTOCOL_VERSION,
            message,
        }
    }
}

impl Serialize for RemoteClientEnvelope {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serialize_envelope(self.version, &self.message, serializer)
    }
}

impl<'de> Deserialize<'de> for RemoteClientEnvelope {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserialize_envelope(deserializer).map(|(version, message)| Self { version, message })
    }
}

impl Serialize for RemoteServerEnvelope {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serialize_envelope(self.version, &self.message, serializer)
    }
}

impl<'de> Deserialize<'de> for RemoteServerEnvelope {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserialize_envelope(deserializer).map(|(version, message)| Self { version, message })
    }
}

impl Serialize for RemoteDeviceClientEnvelope {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serialize_envelope(self.version, &self.message, serializer)
    }
}

impl<'de> Deserialize<'de> for RemoteDeviceClientEnvelope {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserialize_envelope_for_version(deserializer, REMOTE_DEVICE_PROTOCOL_VERSION)
            .map(|(version, message)| Self { version, message })
    }
}

impl Serialize for RemoteDeviceServerEnvelope {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serialize_envelope(self.version, &self.message, serializer)
    }
}

impl<'de> Deserialize<'de> for RemoteDeviceServerEnvelope {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserialize_envelope_for_version(deserializer, REMOTE_DEVICE_PROTOCOL_VERSION)
            .map(|(version, message)| Self { version, message })
    }
}

fn serialize_envelope<S, M>(version: u16, message: &M, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
    M: Serialize + ?Sized,
{
    #[derive(Serialize)]
    struct WireEnvelope<'a, M: ?Sized> {
        version: u16,
        message: &'a M,
    }

    WireEnvelope { version, message }.serialize(serializer)
}

fn deserialize_envelope<'de, D, M>(deserializer: D) -> Result<(u16, M), D::Error>
where
    D: Deserializer<'de>,
    M: DeserializeOwned,
{
    deserialize_envelope_for_version(deserializer, REMOTE_PROTOCOL_VERSION)
}

fn deserialize_envelope_for_version<'de, D, M>(
    deserializer: D,
    expected_version: u16,
) -> Result<(u16, M), D::Error>
where
    D: Deserializer<'de>,
    M: DeserializeOwned,
{
    let raw = RawEnvelope::<M>::deserialize(deserializer)?;
    if raw.version != expected_version {
        return Err(serde::de::Error::custom(format!(
            "unsupported remote protocol version: {}",
            raw.version
        )));
    }
    Ok((raw.version, raw.message))
}

#[derive(Deserialize)]
struct RawEnvelope<M> {
    version: u16,
    message: M,
}
