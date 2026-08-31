pub mod adapter;
pub mod claude;
mod claude_turn;
pub mod codex;
mod codex_launch;
pub mod commands;
mod daemon;
mod event_parsers;
mod event_sink;
pub mod events;
mod history;
mod launch;
mod launch_print;
mod launch_protocol;
mod lifecycle;
mod model_commands;
pub mod models;
mod omp_launch;
mod print_turn;
pub mod providers;
mod runtime;
mod session_commands;
mod sessions;

#[cfg(test)]
#[allow(unused_imports)]
pub(crate) use lifecycle::stop_session;
pub(crate) use lifecycle::{cancel_session, send_message};
pub(crate) use runtime::{
    agent_turn_events_include_done, command_code_result_session_id, find_native_session_file,
    find_resumable_session_file, native_session_path, send_event, AgentChatBackend,
    AgentChatSession,
};
pub use runtime::{AgentChatRuntime, AgentChatRuntimeStatus, AgentChatStartResult};

#[cfg(test)]
mod resident_runtime_tests {
    use super::AgentChatRuntime;

    #[test]
    fn durable_chat_mapping_is_removed_when_a_runtime_closes() {
        let runtime = AgentChatRuntime::default();
        runtime
            .remember_session_for_chat("chat-1", "runtime-1")
            .unwrap();
        assert_eq!(
            runtime.daemon.session_id("chat-1").unwrap().as_deref(),
            Some("runtime-1")
        );
        runtime.forget_session("runtime-1").unwrap();
        assert_eq!(runtime.daemon.session_id("chat-1").unwrap(), None);
    }

    #[test]
    fn runtime_status_starts_empty_and_reports_resource_counters() {
        let runtime = AgentChatRuntime::default();
        let status = runtime.status().unwrap();
        assert_eq!(status.resident_count, 0);
        assert_eq!(status.attached_count, 0);
        assert_eq!(status.detached_count, 0);
        assert_eq!(status.replay_event_count, 0);
    }

    #[test]
    fn cancel_marks_the_flag_but_keeps_the_runtime_resident() {
        use super::event_sink::AgentChatEventSink;
        use super::{cancel_session, AgentChatBackend, AgentChatSession};
        use std::sync::{
            atomic::{AtomicBool, Ordering},
            Arc, Mutex,
        };
        use tauri::ipc::Channel;

        let runtime = AgentChatRuntime::default();
        let session = Arc::new(AgentChatSession {
            provider: "claude".to_string(),
            cwd: std::env::temp_dir(),
            native_id: Arc::new(Mutex::new(None)),
            channel: Arc::new(AgentChatEventSink::new(Channel::new(|_| Ok(())))),
            cancel_requested: Arc::new(AtomicBool::new(false)),
            backend: AgentChatBackend::Claude {
                cwd: std::env::temp_dir(),
                child: Arc::new(Mutex::new(None)),
                history: Arc::new(Mutex::new(Vec::new())),
            },
        });
        runtime
            .sessions
            .write()
            .unwrap()
            .insert("runtime-1".to_string(), Arc::clone(&session));
        runtime
            .remember_session_for_chat("chat-1", "runtime-1")
            .unwrap();

        cancel_session(&session).unwrap();

        assert!(session.cancel_requested.load(Ordering::Relaxed));
        assert!(runtime.session("runtime-1").is_ok());
        assert_eq!(
            runtime.daemon.session_id("chat-1").unwrap().as_deref(),
            Some("runtime-1")
        );
    }
}
