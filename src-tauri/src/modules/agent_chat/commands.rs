#[cfg(test)]
pub(crate) use super::history::parse_native_history;
pub use super::model_commands::{
    __cmd__agent_chat_list_models, __cmd__agent_chat_list_slash_options, agent_chat_list_models,
    agent_chat_list_slash_options,
};
pub use super::session_commands::{
    __cmd__agent_chat_attach, __cmd__agent_chat_cancel, __cmd__agent_chat_close,
    __cmd__agent_chat_detach, __cmd__agent_chat_runtime_status, __cmd__agent_chat_send,
    __cmd__agent_chat_start, agent_chat_attach, agent_chat_cancel, agent_chat_close,
    agent_chat_detach, agent_chat_runtime_status, agent_chat_send, agent_chat_start,
};
use super::{events::AgentChatEvent, history};
use crate::modules::workspace::{authorize_spawn_cwd, WorkspaceEnv, WorkspaceRegistry};

#[tauri::command]
pub fn agent_chat_load_history(
    registry: tauri::State<'_, WorkspaceRegistry>,
    provider: String,
    cwd: String,
    native_session_id: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<Vec<AgentChatEvent>, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let _cwd = authorize_spawn_cwd(&registry, Some(&cwd), &workspace)?
        .ok_or_else(|| "Agent history requires a working folder".to_string())?;
    history::load_native_history(&provider, &native_session_id)
}

#[cfg(test)]
mod resident_runtime_tests {
    use super::super::AgentChatRuntime;

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
        use super::super::event_sink::AgentChatEventSink;
        use super::super::{cancel_session, AgentChatBackend, AgentChatSession};
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
