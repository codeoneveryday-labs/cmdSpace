//! Versioned messages shared by the desktop remote host and native mobile clients.
//!
//! This crate intentionally has no networking, terminal, or platform dependencies.

use serde::{de::DeserializeOwned, Deserialize, Deserializer, Serialize, Serializer};

pub const REMOTE_PROTOCOL_VERSION: u16 = 2;

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
    CreateSession {
        cwd: Option<String>,
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

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProtocolSession {
    pub id: u64,
    pub title: String,
    pub cwd: Option<String>,
    pub agent: Option<String>,
    pub attached: bool,
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
    #[derive(Deserialize)]
    struct RawEnvelope<M> {
        version: u16,
        message: M,
    }

    let raw = RawEnvelope::<M>::deserialize(deserializer)?;
    if raw.version != REMOTE_PROTOCOL_VERSION {
        return Err(serde::de::Error::custom(format!(
            "unsupported remote protocol version: {}",
            raw.version
        )));
    }
    Ok((raw.version, raw.message))
}
