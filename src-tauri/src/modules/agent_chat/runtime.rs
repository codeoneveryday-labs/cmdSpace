use super::daemon::{AgentDaemonIndex, IDLE_REAPER_INTERVAL};
use super::event_sink::AgentChatEventSink;
use super::launch::{
    start_claude as launch_claude, start_codex as launch_codex, start_omp as launch_omp,
    start_print as launch_print,
};
use super::lifecycle::stop_session;
use super::{
    adapter::{build_launch, AdapterKind},
    codex::CodexProtocol,
    events::AgentChatEvent,
};
use serde::Serialize;
use serde_json::Value;
use shared_child::SharedChild;
use std::{
    collections::HashMap,
    process::ChildStdin,
    sync::{
        atomic::{AtomicBool, AtomicU64},
        Arc, Mutex, RwLock,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::ipc::Channel;

pub(crate) struct AgentChatSession {
    pub(crate) provider: String,
    pub(crate) cwd: std::path::PathBuf,
    pub(crate) native_id: Arc<Mutex<Option<String>>>,
    pub(crate) channel: Arc<AgentChatEventSink>,
    /// Set while a user-initiated cancel is tearing down the current turn so
    /// reader threads can suppress the exit-failure error that follows the kill.
    pub(crate) cancel_requested: Arc<AtomicBool>,
    pub(crate) backend: AgentChatBackend,
}

#[derive(Clone, Copy, Default)]
struct AgentChatLifecycleMetrics {
    last_cold_start_ms: Option<u64>,
    last_warm_attach_ms: Option<u64>,
}

pub(crate) enum AgentChatBackend {
    Codex {
        child: Arc<SharedChild>,
        writer: Arc<Mutex<ChildStdin>>,
        protocol: Arc<Mutex<CodexProtocol>>,
    },
    Claude {
        cwd: std::path::PathBuf,
        child: Arc<Mutex<Option<Arc<SharedChild>>>>,
        history: Arc<Mutex<Vec<(String, String)>>>,
    },
    Omp {
        child: Arc<SharedChild>,
        writer: Arc<Mutex<ChildStdin>>,
    },
    Print {
        provider: String,
        cwd: std::path::PathBuf,
        child: Arc<Mutex<Option<Arc<SharedChild>>>>,
        history: Arc<Mutex<Vec<(String, String)>>>,
    },
}

/// Persistent protocol providers own one process across turns. Per-turn
/// providers intentionally exit after each response while their app runtime
/// remains available for the next prompt.
#[derive(Clone, Copy)]
pub(crate) enum AgentChatProviderExit {
    Persistent,
    PerTurn,
}

#[derive(Clone)]
pub struct AgentChatRuntime {
    pub(crate) sessions: Arc<RwLock<HashMap<String, Arc<AgentChatSession>>>>,
    pub(crate) daemon: Arc<AgentDaemonIndex>,
    pub(crate) next_id: Arc<AtomicU64>,
    pub(crate) start_lock: Arc<Mutex<()>>,
    lifecycle_metrics: Arc<Mutex<AgentChatLifecycleMetrics>>,
}

impl Default for AgentChatRuntime {
    fn default() -> Self {
        let runtime = Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            daemon: Arc::new(AgentDaemonIndex::new()),
            next_id: Arc::new(AtomicU64::new(1)),
            start_lock: Arc::new(Mutex::new(())),
            lifecycle_metrics: Arc::new(Mutex::new(AgentChatLifecycleMetrics::default())),
        };
        let reaper = runtime.clone();
        let _ = thread::Builder::new()
            .name("cmdspace-agent-chat-reaper".to_string())
            .spawn(move || loop {
                thread::sleep(IDLE_REAPER_INTERVAL);
                if reaper.reap_idle().is_err() {
                    return;
                }
            });
        runtime
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentChatStartResult {
    pub(crate) session_id: String,
    pub(crate) attachment_token: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentChatRuntimeStatus {
    pub resident_count: usize,
    pub attached_count: usize,
    pub detached_count: usize,
    pub replay_event_count: usize,
    pub last_cold_start_ms: Option<u64>,
    pub last_warm_attach_ms: Option<u64>,
}

impl AgentChatRuntime {
    pub fn validate_provider(
        &self,
        provider: &str,
    ) -> Result<AdapterKind, super::adapter::AgentChatError> {
        Ok(build_launch(provider, std::path::Path::new("."))?.adapter)
    }

    pub(crate) fn start_codex(
        &self,
        cwd: std::path::PathBuf,
        prompt: String,
        native_session_id: Option<String>,
        model: Option<String>,
        channel: Channel<AgentChatEvent>,
    ) -> Result<AgentChatStartResult, String> {
        launch_codex(self, cwd, prompt, native_session_id, model, channel)
    }

    pub(crate) fn start_claude(
        &self,
        cwd: std::path::PathBuf,
        prompt: String,
        native_session_id: Option<String>,
        model: Option<String>,
        channel: Channel<AgentChatEvent>,
    ) -> Result<AgentChatStartResult, String> {
        launch_claude(self, cwd, prompt, native_session_id, model, channel)
    }

    pub(crate) fn start_omp(
        &self,
        cwd: std::path::PathBuf,
        prompt: String,
        model: Option<String>,
        channel: Channel<AgentChatEvent>,
    ) -> Result<AgentChatStartResult, String> {
        launch_omp(self, cwd, prompt, model, channel)
    }

    pub(crate) fn start_print(
        &self,
        provider: &str,
        cwd: std::path::PathBuf,
        prompt: String,
        native_session_id: Option<String>,
        model: Option<String>,
        channel: Channel<AgentChatEvent>,
    ) -> Result<AgentChatStartResult, String> {
        launch_print(
            self,
            provider,
            cwd,
            prompt,
            native_session_id,
            model,
            channel,
        )
    }

    pub(crate) fn session(&self, session_id: &str) -> Result<Arc<AgentChatSession>, String> {
        self.sessions
            .read()
            .map_err(|_| "agent chat state lock poisoned".to_string())?
            .get(session_id)
            .cloned()
            .ok_or_else(|| format!("unknown agent chat session '{session_id}'"))
    }
    pub(crate) fn session_for_chat(
        &self,
        chat_id: &str,
    ) -> Result<Option<Arc<AgentChatSession>>, String> {
        let Some(session_id) = self.daemon.session_id(chat_id)? else {
            return Ok(None);
        };
        let session = self
            .sessions
            .read()
            .map_err(|_| "agent chat state lock poisoned".to_string())?
            .get(&session_id)
            .cloned();
        if session.is_none() {
            self.daemon.forget(&session_id)?;
        }
        Ok(session)
    }

    pub(crate) fn remember_session_for_chat(
        &self,
        chat_id: &str,
        session_id: &str,
    ) -> Result<(), String> {
        self.daemon.remember(chat_id, session_id)
    }

    pub(crate) fn attach_chat(
        &self,
        chat_id: &str,
        channel: Channel<AgentChatEvent>,
    ) -> Result<Option<AgentChatStartResult>, String> {
        let attach_started_at = Instant::now();
        let Some(session) = self.session_for_chat(chat_id)? else {
            return Ok(None);
        };
        let session_id = self
            .daemon
            .session_id(chat_id)?
            .ok_or_else(|| "agent chat durable session disappeared".to_string())?;
        let attachment_token = session.channel.attach(channel)?;
        self.daemon.mark_attached(&session_id)?;
        self.record_lifecycle_latency(false, attach_started_at.elapsed());
        Ok(Some(AgentChatStartResult {
            session_id,
            attachment_token,
        }))
    }

    /// Serializes durable-chat admission so concurrent starts cannot launch
    /// more than one provider runtime for the same chat identity.
    pub(crate) fn start_or_attach<F>(
        &self,
        chat_id: Option<&str>,
        channel: Channel<AgentChatEvent>,
        start: F,
    ) -> Result<AgentChatStartResult, String>
    where
        F: FnOnce() -> Result<AgentChatStartResult, String>,
    {
        let _start_guard = self
            .start_lock
            .lock()
            .map_err(|_| "agent chat start lock poisoned".to_string())?;
        let chat_id = chat_id.map(str::trim).filter(|id| !id.is_empty());

        if let Some(chat_id) = chat_id {
            if let Some(attached) = self.attach_chat(chat_id, channel)? {
                return Ok(attached);
            }
        }

        let result = start()?;
        if let Some(chat_id) = chat_id {
            self.remember_session_for_chat(chat_id, &result.session_id)?;
        }
        Ok(result)
    }

    pub(crate) fn forget_session(&self, session_id: &str) -> Result<(), String> {
        self.daemon.forget(session_id)
    }

    pub(crate) fn close_session(&self, session_id: &str) -> Result<(), String> {
        let session = self
            .sessions
            .write()
            .map_err(|_| "agent chat state lock poisoned".to_string())?
            .remove(session_id);
        self.forget_session(session_id)?;
        if let Some(session) = session {
            stop_session(&session)?;
        }
        Ok(())
    }

    /// Drops a runtime whose provider has already ended. This must not call
    /// `stop_session`: an EOF/exit is observed after the provider owns its own
    /// shutdown, so killing or waiting here can race its completed teardown.
    pub(crate) fn handle_provider_exit(
        &self,
        session_id: &str,
        exit: AgentChatProviderExit,
    ) -> Result<(), String> {
        if matches!(exit, AgentChatProviderExit::PerTurn) {
            return Ok(());
        }
        // Admission writes the durable mapping only after a provider reader is
        // live. Serialize against it so an immediate EOF cannot clear the
        // session before that mapping is recorded.
        let _start_guard = self
            .start_lock
            .lock()
            .map_err(|_| "agent chat start lock poisoned".to_string())?;
        self.sessions
            .write()
            .map_err(|_| "agent chat state lock poisoned".to_string())?
            .remove(session_id);
        self.forget_session(session_id)
    }

    pub(crate) fn detach_chat(
        &self,
        chat_id: &str,
        session_id: Option<&str>,
        attachment_token: Option<&str>,
    ) -> Result<(), String> {
        let (Some(session_id), Some(attachment_token)) = (
            session_id.map(str::trim).filter(|id| !id.is_empty()),
            attachment_token
                .map(str::trim)
                .filter(|token| !token.is_empty()),
        ) else {
            return Ok(());
        };
        let Some(current_session_id) = self.daemon.session_id(chat_id)? else {
            return Ok(());
        };
        if current_session_id != session_id {
            return Ok(());
        }
        let Some(session) = self.session_for_chat(chat_id)? else {
            return Ok(());
        };
        if !session.channel.detach_if_current(attachment_token)? {
            return Ok(());
        }
        self.daemon.mark_detached(chat_id)
    }

    pub(crate) fn reap_idle(&self) -> Result<(), String> {
        self.reap_idle_at(Instant::now())
    }

    pub(crate) fn reap_idle_at(&self, now: Instant) -> Result<(), String> {
        for session_id in self.daemon.expired_session_ids_at(now)? {
            let session = self
                .sessions
                .write()
                .map_err(|_| "agent chat state lock poisoned".to_string())?
                .remove(&session_id);
            self.daemon.forget(&session_id)?;
            if let Some(session) = session {
                stop_session(&session)?;
                log::debug!("agent chat idle runtime reaped session={session_id}");
            }
        }
        Ok(())
    }

    /// Records wall-clock admission latency without letting telemetry affect a
    /// successful provider start or warm attach.
    pub(crate) fn record_lifecycle_latency(&self, cold_start: bool, elapsed: Duration) {
        let Ok(mut metrics) = self.lifecycle_metrics.lock() else {
            return;
        };
        let elapsed_ms = elapsed.as_millis().try_into().unwrap_or(u64::MAX);
        if cold_start {
            metrics.last_cold_start_ms = Some(elapsed_ms);
        } else {
            metrics.last_warm_attach_ms = Some(elapsed_ms);
        }
    }

    pub(crate) fn status(&self) -> Result<AgentChatRuntimeStatus, String> {
        let sessions = self
            .sessions
            .read()
            .map_err(|_| "agent chat state lock poisoned".to_string())?;
        let resident_count = sessions.len();
        let detached_count = self.daemon.detached_count()?;
        let replay_event_count = sessions
            .values()
            .map(|session| session.channel.replay_len())
            .sum();
        let metrics = self
            .lifecycle_metrics
            .lock()
            .map(|metrics| *metrics)
            .unwrap_or_default();
        Ok(AgentChatRuntimeStatus {
            resident_count,
            attached_count: resident_count.saturating_sub(detached_count),
            detached_count,
            replay_event_count,
            last_cold_start_ms: metrics.last_cold_start_ms,
            last_warm_attach_ms: metrics.last_warm_attach_ms,
        })
    }
}

/// Interrupts the current turn without tearing the runtime down. Codex/OMP
/// keep their persistent process; Claude/Print kill only this turn's child.
/// The cancel flag tells reader threads to swallow the interrupt-fallout
/// errors until the next turn starts.
/// Sends a follow-up prompt through the session's backend without changing
/// process ownership: persistent backends open a new turn, per-turn backends
/// spawn a fresh child for this turn only.
pub(crate) fn command_code_result_session_id(line: &str) -> Option<String> {
    let value = serde_json::from_str::<Value>(line).ok()?;
    (value.get("type").and_then(Value::as_str) == Some("result"))
        .then(|| {
            value
                .get("sessionId")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .flatten()
}

pub(crate) fn native_session_path(provider: &str, session_id: &str) -> Option<std::path::PathBuf> {
    let home = dirs::home_dir()?;
    let root = match provider {
        "codex" => home.join(".codex").join("sessions"),
        "claude" => home.join(".claude").join("projects"),
        "cmd" => home.join(".commandcode").join("projects"),
        _ => return None,
    };
    find_resumable_session_file(&root, session_id)
}

pub(crate) fn find_resumable_session_file(
    root: &std::path::Path,
    session_id: &str,
) -> Option<std::path::PathBuf> {
    find_native_session_file(root, session_id)
        .ok()
        .flatten()
        .filter(|path| std::fs::metadata(path).is_ok_and(|metadata| metadata.len() > 0))
}

pub(crate) fn agent_turn_events_include_done(events: &[AgentChatEvent]) -> bool {
    events
        .iter()
        .any(|event| matches!(event, AgentChatEvent::Done))
}

pub(crate) fn send_event(channel: &Arc<AgentChatEventSink>, event: AgentChatEvent) {
    channel.send(event);
}

pub(crate) fn find_native_session_file(
    root: &std::path::Path,
    session_id: &str,
) -> Result<Option<std::path::PathBuf>, String> {
    let entries = std::fs::read_dir(root).map_err(|error| error.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_native_session_file(&path, session_id)? {
                return Ok(Some(found));
            }
        } else if path.extension().and_then(|extension| extension.to_str()) == Some("jsonl") {
            let file_name = path.file_name().and_then(|name| name.to_str());
            if file_name.is_some_and(|name| name.ends_with(".checkpoints.jsonl")) {
                continue;
            }
            if file_name.is_some_and(|name| name.contains(session_id)) {
                return Ok(Some(path));
            }
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::{
        AgentChatBackend, AgentChatLifecycleMetrics, AgentChatProviderExit, AgentChatRuntime,
        AgentChatSession, AgentChatStartResult,
    };
    use crate::modules::agent_chat::events::AgentChatEvent;
    use crate::modules::agent_chat::{daemon::AgentDaemonIndex, event_sink::AgentChatEventSink};
    use std::sync::{
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
        Arc, Barrier, Mutex, RwLock,
    };
    use std::time::{Duration, Instant};
    use tauri::ipc::Channel;

    fn runtime_without_reaper() -> AgentChatRuntime {
        AgentChatRuntime {
            sessions: Arc::new(RwLock::new(Default::default())),
            daemon: Arc::new(AgentDaemonIndex::new()),
            next_id: Arc::new(AtomicU64::new(1)),
            start_lock: Arc::new(Mutex::new(())),
            lifecycle_metrics: Arc::new(Mutex::new(AgentChatLifecycleMetrics::default())),
        }
    }

    fn test_session(channel: Channel<AgentChatEvent>) -> Arc<AgentChatSession> {
        Arc::new(AgentChatSession {
            provider: "test".to_string(),
            cwd: std::env::temp_dir(),
            native_id: Arc::new(Mutex::new(None)),
            channel: Arc::new(AgentChatEventSink::new(channel)),
            cancel_requested: Arc::new(AtomicBool::new(false)),
            backend: AgentChatBackend::Claude {
                cwd: std::env::temp_dir(),
                child: Arc::new(Mutex::new(None)),
                history: Arc::new(Mutex::new(Vec::new())),
            },
        })
    }

    fn no_op_channel() -> Channel<AgentChatEvent> {
        Channel::new(|_| Ok(()))
    }

    #[test]
    fn concurrent_starts_for_one_chat_create_one_runtime() {
        let runtime = runtime_without_reaper();
        let barrier = Arc::new(Barrier::new(2));
        let starts = Arc::new(AtomicUsize::new(0));

        let handles = (0..2)
            .map(|_| {
                let runtime = runtime.clone();
                let barrier = Arc::clone(&barrier);
                let starts = Arc::clone(&starts);
                std::thread::spawn(move || {
                    barrier.wait();
                    let channel = no_op_channel();
                    let start_channel = channel.clone();
                    runtime
                        .start_or_attach(Some("chat-1"), channel, || {
                            let sequence = starts.fetch_add(1, Ordering::SeqCst);
                            let session_id = format!("runtime-{sequence}");
                            runtime
                                .sessions
                                .write()
                                .map_err(|_| "agent chat state lock poisoned".to_string())?
                                .insert(session_id.clone(), test_session(start_channel));
                            Ok(AgentChatStartResult {
                                session_id,
                                attachment_token: "0".to_string(),
                            })
                        })
                        .map(|result| result.session_id)
                })
            })
            .collect::<Vec<_>>();

        let session_ids = handles
            .into_iter()
            .map(|handle| {
                handle
                    .join()
                    .expect("thread should not panic")
                    .expect("start")
            })
            .collect::<Vec<_>>();

        assert_eq!(starts.load(Ordering::SeqCst), 1);
        assert_eq!(session_ids[0], session_ids[1]);
        assert_eq!(
            runtime
                .daemon
                .session_id("chat-1")
                .expect("mapping")
                .as_deref(),
            Some(session_ids[0].as_str()),
        );
        assert_eq!(runtime.sessions.read().expect("sessions").len(), 1);
    }

    #[test]
    fn concurrent_starts_for_different_chats_create_distinct_runtimes() {
        let runtime = runtime_without_reaper();
        let barrier = Arc::new(Barrier::new(2));
        let starts = Arc::new(AtomicUsize::new(0));

        let handles = ["chat-a", "chat-b"].map(|chat_id| {
            let runtime = runtime.clone();
            let barrier = Arc::clone(&barrier);
            let starts = Arc::clone(&starts);
            std::thread::spawn(move || {
                barrier.wait();
                let channel = no_op_channel();
                let start_channel = channel.clone();
                runtime
                    .start_or_attach(Some(chat_id), channel, || {
                        let sequence = starts.fetch_add(1, Ordering::SeqCst);
                        let session_id = format!("runtime-{sequence}");
                        runtime
                            .sessions
                            .write()
                            .map_err(|_| "agent chat state lock poisoned".to_string())?
                            .insert(session_id.clone(), test_session(start_channel));
                        Ok(AgentChatStartResult {
                            session_id,
                            attachment_token: "0".to_string(),
                        })
                    })
                    .map(|result| result.session_id)
            })
        });

        let [first_handle, second_handle] = handles;
        let first = first_handle
            .join()
            .expect("thread should not panic")
            .expect("start");
        let second = second_handle
            .join()
            .expect("thread should not panic")
            .expect("start");

        assert_eq!(starts.load(Ordering::SeqCst), 2);
        assert_ne!(first, second);
        assert_eq!(runtime.sessions.read().expect("sessions").len(), 2);
    }

    #[test]
    fn idle_reaping_removes_the_expired_runtime_and_durable_mapping() {
        let runtime = runtime_without_reaper();
        let session_id = "runtime-idle".to_string();
        runtime
            .sessions
            .write()
            .expect("sessions")
            .insert(session_id.clone(), test_session(no_op_channel()));
        runtime
            .remember_session_for_chat("chat-idle", &session_id)
            .expect("mapping");

        let now = Instant::now();
        runtime
            .daemon
            .mark_detached_at(
                "chat-idle",
                now - super::super::daemon::IDLE_RUNTIME_GRACE - Duration::from_secs(1),
            )
            .expect("detach");
        runtime.reap_idle_at(now).expect("reap");

        assert!(runtime.session(&session_id).is_err());
        assert_eq!(
            runtime.daemon.session_id("chat-idle").expect("mapping"),
            None,
        );
    }

    #[test]
    fn runtime_status_exposes_last_cold_and_warm_lifecycle_latency() {
        let runtime = runtime_without_reaper();

        runtime.record_lifecycle_latency(true, Duration::from_millis(37));
        runtime.record_lifecycle_latency(false, Duration::from_millis(5));

        let status = runtime.status().expect("runtime status");
        assert_eq!(status.last_cold_start_ms, Some(37));
        assert_eq!(status.last_warm_attach_ms, Some(5));
    }

    #[test]
    fn successful_attach_records_warm_attach_latency() {
        let runtime = runtime_without_reaper();
        let session_id = "runtime-warm".to_string();
        runtime
            .sessions
            .write()
            .expect("sessions")
            .insert(session_id.clone(), test_session(no_op_channel()));
        runtime
            .remember_session_for_chat("chat-warm", &session_id)
            .expect("mapping");

        runtime
            .attach_chat("chat-warm", no_op_channel())
            .expect("attach");

        assert!(runtime
            .status()
            .expect("runtime status")
            .last_warm_attach_ms
            .is_some());
    }

    #[test]
    fn concurrent_starts_for_different_chats_still_obey_the_global_start_gate() {
        let runtime = runtime_without_reaper();
        let barrier = Arc::new(Barrier::new(2));
        let starts = Arc::new(AtomicUsize::new(0));
        let in_flight = Arc::new(AtomicUsize::new(0));
        let max_in_flight = Arc::new(AtomicUsize::new(0));

        let handles = ["chat-a", "chat-b"].map(|chat_id| {
            let runtime = runtime.clone();
            let barrier = Arc::clone(&barrier);
            let starts = Arc::clone(&starts);
            let in_flight = Arc::clone(&in_flight);
            let max_in_flight = Arc::clone(&max_in_flight);
            std::thread::spawn(move || {
                barrier.wait();
                let channel = no_op_channel();
                let start_channel = channel.clone();
                runtime
                    .start_or_attach(Some(chat_id), channel, || {
                        let now_in_flight = in_flight.fetch_add(1, Ordering::SeqCst) + 1;
                        max_in_flight.fetch_max(now_in_flight, Ordering::SeqCst);
                        std::thread::sleep(Duration::from_millis(25));
                        in_flight.fetch_sub(1, Ordering::SeqCst);
                        let sequence = starts.fetch_add(1, Ordering::SeqCst);
                        let session_id = format!("runtime-{sequence}");
                        runtime
                            .sessions
                            .write()
                            .map_err(|_| "agent chat state lock poisoned".to_string())?
                            .insert(session_id.clone(), test_session(start_channel));
                        Ok(AgentChatStartResult {
                            session_id,
                            attachment_token: "0".to_string(),
                        })
                    })
                    .map(|result| result.session_id)
            })
        });

        let [first_handle, second_handle] = handles;
        let first = first_handle
            .join()
            .expect("thread should not panic")
            .expect("start");
        let second = second_handle
            .join()
            .expect("thread should not panic")
            .expect("start");

        assert_eq!(starts.load(Ordering::SeqCst), 2);
        assert_eq!(max_in_flight.load(Ordering::SeqCst), 1);
        assert_ne!(first, second);
    }

    #[test]
    fn explicit_close_removes_the_resident_session_and_durable_mapping() {
        let runtime = runtime_without_reaper();
        let session_id = "runtime-close".to_string();
        runtime
            .sessions
            .write()
            .expect("sessions")
            .insert(session_id.clone(), test_session(no_op_channel()));
        runtime
            .remember_session_for_chat("chat-close", &session_id)
            .expect("mapping");

        runtime.close_session(&session_id).expect("close");

        assert!(runtime.session(&session_id).is_err());
        assert_eq!(
            runtime.daemon.session_id("chat-close").expect("mapping"),
            None,
        );
    }

    #[test]
    fn persistent_provider_exit_removes_the_runtime_and_durable_mapping_without_stopping_it() {
        let runtime = runtime_without_reaper();
        let session_id = "runtime-provider-exit".to_string();
        runtime
            .sessions
            .write()
            .expect("sessions")
            .insert(session_id.clone(), test_session(no_op_channel()));
        runtime
            .remember_session_for_chat("chat-provider-exit", &session_id)
            .expect("mapping");

        runtime
            .handle_provider_exit(&session_id, AgentChatProviderExit::Persistent)
            .expect("provider exit");

        assert!(runtime.session(&session_id).is_err());
        assert_eq!(
            runtime
                .daemon
                .session_id("chat-provider-exit")
                .expect("mapping"),
            None,
        );
    }

    #[test]
    fn per_turn_provider_exit_keeps_the_resident_runtime_and_durable_mapping() {
        let runtime = runtime_without_reaper();
        let session_id = "runtime-per-turn-exit".to_string();
        runtime
            .sessions
            .write()
            .expect("sessions")
            .insert(session_id.clone(), test_session(no_op_channel()));
        runtime
            .remember_session_for_chat("chat-per-turn-exit", &session_id)
            .expect("mapping");

        runtime
            .handle_provider_exit(&session_id, AgentChatProviderExit::PerTurn)
            .expect("provider exit");

        assert!(runtime.session(&session_id).is_ok());
        assert_eq!(
            runtime
                .daemon
                .session_id("chat-per-turn-exit")
                .expect("mapping")
                .as_deref(),
            Some(session_id.as_str()),
        );
    }

    #[test]
    fn attach_clears_a_durable_mapping_when_its_runtime_has_already_exited() {
        let runtime = runtime_without_reaper();
        runtime
            .remember_session_for_chat("chat-stale-mapping", "runtime-missing")
            .expect("mapping");

        assert!(runtime
            .attach_chat("chat-stale-mapping", no_op_channel())
            .expect("attach")
            .is_none());
        assert_eq!(
            runtime
                .daemon
                .session_id("chat-stale-mapping")
                .expect("mapping"),
            None,
        );
    }

    #[test]
    fn detach_marks_a_runtime_idle_without_closing_it() {
        let runtime = runtime_without_reaper();
        let session_id = "runtime-detach".to_string();
        let session = test_session(no_op_channel());
        runtime
            .sessions
            .write()
            .expect("sessions")
            .insert(session_id.clone(), Arc::clone(&session));
        runtime
            .remember_session_for_chat("chat-detach", &session_id)
            .expect("mapping");

        session.channel.send(AgentChatEvent::Assistant {
            text: "buffered".to_string(),
        });
        let attachment_token = session
            .channel
            .attachment_token()
            .expect("attachment token");
        runtime
            .detach_chat("chat-detach", Some(&session_id), Some(&attachment_token))
            .expect("detach");

        assert!(runtime.session(&session_id).is_ok());
        let status = runtime.status().expect("runtime status");
        assert_eq!(status.resident_count, 1);
        assert_eq!(status.attached_count, 0);
        assert_eq!(status.detached_count, 1);
        assert_eq!(status.replay_event_count, 1);
    }

    #[test]
    fn stale_detach_does_not_mark_the_current_attachment_idle() {
        let runtime = runtime_without_reaper();
        let session_id = "runtime-current".to_string();
        let session = test_session(no_op_channel());
        runtime
            .sessions
            .write()
            .expect("sessions")
            .insert(session_id.clone(), Arc::clone(&session));
        runtime
            .remember_session_for_chat("chat-current", &session_id)
            .expect("mapping");

        let stale_token = session.channel.attachment_token().expect("initial token");
        let current_token = session
            .channel
            .attach(no_op_channel())
            .expect("replacement attachment");

        runtime
            .detach_chat("chat-current", None, None)
            .expect("legacy detach is a no-op");
        assert_eq!(runtime.status().expect("status").attached_count, 1);

        runtime
            .detach_chat("chat-current", Some("runtime-stale"), Some(&current_token))
            .expect("wrong-session detach");
        assert_eq!(runtime.status().expect("status").attached_count, 1);

        runtime
            .detach_chat("chat-current", Some(&session_id), Some(&stale_token))
            .expect("stale detach");
        assert_eq!(runtime.status().expect("status").attached_count, 1);

        runtime
            .detach_chat("chat-current", Some(&session_id), Some(&current_token))
            .expect("current detach");
        assert_eq!(runtime.status().expect("status").detached_count, 1);
    }

    #[test]
    fn start_result_serializes_the_attachment_token_for_the_frontend_contract() {
        let result = AgentChatStartResult {
            session_id: "runtime-1".to_string(),
            attachment_token: "1".to_string(),
        };

        assert_eq!(
            serde_json::to_value(result).expect("serialize result"),
            serde_json::json!({ "sessionId": "runtime-1", "attachmentToken": "1" }),
        );
    }
}
