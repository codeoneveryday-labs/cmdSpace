use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::AtomicU32;
use std::sync::{Arc, RwLock};

use portable_pty::PtySize;
use serde::Serialize;

use super::{session, session_output};
use super::{PtyError, PtyErrorKind, PtyResult};

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

    pub fn subscribe_output(&self, id: u32) -> PtyResult<PtyOutputSubscription> {
        self.sessions
            .read()
            .unwrap()
            .get(&id)
            .cloned()
            .map(|session| session.subscribe_output())
            .ok_or_else(|| PtyError::new(PtyErrorKind::SessionNotFound))
    }

    pub fn output_snapshot(&self, id: u32) -> PtyResult<Vec<u8>> {
        self.sessions
            .read()
            .unwrap()
            .get(&id)
            .cloned()
            .map(|session| session.output_snapshot())
            .ok_or_else(|| PtyError::new(PtyErrorKind::SessionNotFound))
    }

    pub fn write_remote(&self, id: u32, data: &str) -> PtyResult<()> {
        let session = self
            .sessions
            .read()
            .unwrap()
            .get(&id)
            .cloned()
            .ok_or_else(|| PtyError::new(PtyErrorKind::SessionNotFound))?;
        let mut writer = session.writer.lock().unwrap();
        writer
            .write_all(data.as_bytes())
            .map_err(|_| PtyError::new(PtyErrorKind::WriteFailed))?;
        writer
            .flush()
            .map_err(|_| PtyError::new(PtyErrorKind::WriteFailed))
    }

    pub fn restore_desktop_size(&self, id: u32) -> PtyResult<()> {
        let Some((cols, rows)) = self.sizes.read().unwrap().get(&id).copied() else {
            return Ok(());
        };
        let session = self
            .sessions
            .read()
            .unwrap()
            .get(&id)
            .cloned()
            .ok_or_else(|| PtyError::new(PtyErrorKind::SessionNotFound))?;
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
            .map_err(|_| PtyError::new(PtyErrorKind::ResizeFailed));
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_sessions_return_stable_errors() {
        let state = PtyState::default();

        assert_eq!(
            state.output_snapshot(7).unwrap_err(),
            PtyError::new(PtyErrorKind::SessionNotFound)
        );
        assert_eq!(
            state.subscribe_output(7).unwrap_err(),
            PtyError::new(PtyErrorKind::SessionNotFound)
        );
        assert_eq!(
            state.write_remote(7, "input").unwrap_err(),
            PtyError::new(PtyErrorKind::SessionNotFound)
        );
    }
}
