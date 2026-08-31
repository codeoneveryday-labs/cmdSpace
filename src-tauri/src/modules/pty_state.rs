use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::AtomicU32;
use std::sync::{Arc, RwLock};

use portable_pty::PtySize;
use serde::Serialize;

use super::{session, session_output};

type PtyOutputSubscription = session_output::OutputSubscription;

#[derive(Clone)]
pub struct PtyState {
    pub(super) sessions: Arc<RwLock<HashMap<u32, Arc<session::Session>>>>,
    pub(super) metadata: Arc<RwLock<HashMap<u32, PtySessionInfo>>>,
    pub(super) sizes: Arc<RwLock<HashMap<u32, (u16, u16)>>>,
    // Starts at 1 so freshly-handed-out ids are never 0, which the frontend
    // sometimes treats as "unset". Increments monotonically; never reused.
    pub(super) next_id: Arc<AtomicU32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySessionInfo {
    pub id: u32,
    pub title: String,
    pub cwd: Option<String>,
    pub agent: Option<String>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            metadata: Arc::new(RwLock::new(HashMap::new())),
            sizes: Arc::new(RwLock::new(HashMap::new())),
            next_id: Arc::new(AtomicU32::new(1)),
        }
    }
}

impl PtyState {
    pub fn list_sessions(&self) -> Vec<PtySessionInfo> {
        let mut sessions: Vec<_> = self
            .metadata
            .read()
            .map(|metadata| metadata.values().cloned().collect())
            .unwrap_or_default();
        sessions.sort_by_key(|session| session.id);
        sessions
    }

    pub fn subscribe_output(&self, id: u32) -> Result<PtyOutputSubscription, String> {
        self.sessions
            .read()
            .unwrap()
            .get(&id)
            .cloned()
            .map(|session| session.subscribe_output())
            .ok_or_else(|| "no session".to_string())
    }

    pub fn output_snapshot(&self, id: u32) -> Result<Vec<u8>, String> {
        self.sessions
            .read()
            .unwrap()
            .get(&id)
            .cloned()
            .map(|session| session.output_snapshot())
            .ok_or_else(|| "no session".to_string())
    }

    pub fn write_remote(&self, id: u32, data: &str) -> Result<(), String> {
        let session = self
            .sessions
            .read()
            .unwrap()
            .get(&id)
            .cloned()
            .ok_or_else(|| "no session".to_string())?;
        let mut writer = session.writer.lock().unwrap();
        writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())
    }

    pub fn restore_desktop_size(&self, id: u32) -> Result<(), String> {
        let Some((cols, rows)) = self.sizes.read().unwrap().get(&id).copied() else {
            return Ok(());
        };
        let session = self
            .sessions
            .read()
            .unwrap()
            .get(&id)
            .cloned()
            .ok_or_else(|| "no session".to_string())?;
        let result = session
            .master
            .lock()
            .unwrap()
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string());
        result
    }
}
