use std::{
    collections::HashMap,
    sync::{Mutex, RwLock},
    time::{Duration, Instant},
};

pub(crate) const IDLE_RUNTIME_GRACE: Duration = Duration::from_secs(15 * 60);
pub(crate) const IDLE_REAPER_INTERVAL: Duration = Duration::from_secs(60);

/// Durable chat identity and detached-runtime policy live behind this seam.
/// Provider processes remain owned by `AgentChatRuntime`; this index only
/// decides which runtime a chat refers to and when an unattached runtime is
/// eligible for cleanup.
pub(crate) struct AgentDaemonIndex {
    durable_sessions: RwLock<HashMap<String, String>>,
    detached_at: Mutex<HashMap<String, Instant>>,
}

impl AgentDaemonIndex {
    pub(crate) fn new() -> Self {
        Self {
            durable_sessions: RwLock::new(HashMap::new()),
            detached_at: Mutex::new(HashMap::new()),
        }
    }

    pub(crate) fn session_id(&self, chat_id: &str) -> Result<Option<String>, String> {
        Ok(self
            .durable_sessions
            .read()
            .map_err(|_| "agent chat durable session lock poisoned".to_string())?
            .get(chat_id)
            .cloned())
    }

    pub(crate) fn remember(&self, chat_id: &str, session_id: &str) -> Result<(), String> {
        self.detached_at
            .lock()
            .map_err(|_| "agent chat idle lock poisoned".to_string())?
            .remove(session_id);
        self.durable_sessions
            .write()
            .map_err(|_| "agent chat durable session lock poisoned".to_string())?
            .insert(chat_id.to_string(), session_id.to_string());
        Ok(())
    }

    pub(crate) fn mark_attached(&self, session_id: &str) -> Result<(), String> {
        self.detached_at
            .lock()
            .map_err(|_| "agent chat idle lock poisoned".to_string())?
            .remove(session_id);
        Ok(())
    }

    pub(crate) fn mark_detached(&self, chat_id: &str) -> Result<(), String> {
        self.mark_detached_at(chat_id, Instant::now())
    }

    pub(crate) fn mark_detached_at(
        &self,
        chat_id: &str,
        detached_at: Instant,
    ) -> Result<(), String> {
        let Some(session_id) = self.session_id(chat_id)? else {
            return Ok(());
        };
        self.detached_at
            .lock()
            .map_err(|_| "agent chat idle lock poisoned".to_string())?
            .insert(session_id, detached_at);
        Ok(())
    }

    pub(crate) fn forget(&self, session_id: &str) -> Result<(), String> {
        self.detached_at
            .lock()
            .map_err(|_| "agent chat idle lock poisoned".to_string())?
            .remove(session_id);
        self.durable_sessions
            .write()
            .map_err(|_| "agent chat durable session lock poisoned".to_string())?
            .retain(|_, id| id != session_id);
        Ok(())
    }

    pub(crate) fn expired_session_ids_at(&self, now: Instant) -> Result<Vec<String>, String> {
        let mut detached = self
            .detached_at
            .lock()
            .map_err(|_| "agent chat idle lock poisoned".to_string())?;
        let expired = detached
            .iter()
            .filter_map(|(session_id, detached_at)| {
                (now.checked_duration_since(*detached_at)
                    .is_some_and(|elapsed| elapsed >= IDLE_RUNTIME_GRACE))
                .then_some(session_id.clone())
            })
            .collect::<Vec<_>>();
        for session_id in &expired {
            detached.remove(session_id);
        }
        Ok(expired)
    }

    pub(crate) fn detached_count(&self) -> Result<usize, String> {
        Ok(self
            .detached_at
            .lock()
            .map_err(|_| "agent chat idle lock poisoned".to_string())?
            .len())
    }
}

#[cfg(test)]
mod tests {
    use super::AgentDaemonIndex;

    #[test]
    fn durable_identity_survives_detach_until_forget() {
        let index = AgentDaemonIndex::new();
        index.remember("chat-1", "runtime-1").unwrap();
        index.mark_detached("chat-1").unwrap();
        assert_eq!(
            index.session_id("chat-1").unwrap().as_deref(),
            Some("runtime-1")
        );
        assert_eq!(index.detached_count().unwrap(), 1);

        index.mark_attached("runtime-1").unwrap();
        assert_eq!(index.detached_count().unwrap(), 0);
        index.forget("runtime-1").unwrap();
        assert_eq!(index.session_id("chat-1").unwrap(), None);
    }
}
