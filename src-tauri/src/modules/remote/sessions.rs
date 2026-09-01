use std::{
    collections::{HashMap, VecDeque},
    io::Write,
    sync::{Arc, Condvar, Mutex},
};

pub(crate) const REMOTE_OUTPUT_LIMIT: usize = 512;
pub(crate) const REMOTE_SESSION_ID_START: u64 = u32::MAX as u64 + 1;
pub(crate) static NEXT_REMOTE_RUNTIME_ID: std::sync::atomic::AtomicU64 =
    std::sync::atomic::AtomicU64::new(1);

pub(crate) struct RemoteRuntime {
    pub(crate) id: u64,
    pub(crate) next_id: u64,
    pub(crate) sessions: HashMap<u64, Arc<RemoteTerminal>>,
}

pub(crate) struct RemoteTerminal {
    pub(crate) cwd: Option<String>,
    pub(crate) workspace_id: Option<String>,
    /// Native mobile terminals are private to the paired device which created
    /// them. Browser-only remote terminals leave this unset.
    pub(crate) owner_device_id: Option<String>,
    pub(crate) writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub(crate) master: Mutex<Box<dyn portable_pty::MasterPty + Send>>,
    pub(crate) killer: Mutex<Box<dyn portable_pty::ChildKiller + Send + Sync>>,
    pub(crate) output: Mutex<RemoteOutput>,
    pub(crate) changed: Condvar,
    pub(crate) native_controller: Mutex<Option<String>>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RemoteRuntimeSessionInfo {
    pub(crate) id: u64,
    pub(crate) title: String,
    pub(crate) cwd: Option<String>,
}

pub(crate) struct RemoteOutput {
    pub(crate) next_seq: u64,
    pub(crate) chunks: VecDeque<(u64, Vec<u8>)>,
    pub(crate) exited: bool,
}
