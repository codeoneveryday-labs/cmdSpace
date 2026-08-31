use super::{
    event_sink::AgentChatEventSink,
    events::AgentChatEvent,
    native_session_path,
    sessions::{spawn_claude_turn, spawn_print_turn},
    AgentChatBackend, AgentChatRuntime, AgentChatSession, AgentChatStartResult,
};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::ipc::Channel;

pub(crate) fn start_claude(
    runtime: &AgentChatRuntime,
    cwd: std::path::PathBuf,
    prompt: String,
    native_session_id: Option<String>,
    model: Option<String>,
    channel: Channel<AgentChatEvent>,
) -> Result<AgentChatStartResult, String> {
    let native_session_id = match native_session_id {
        Some(id) if native_session_path("claude", &id).is_some() => Some(id),
        Some(_) => {
            return Err(
                "Saved Claude session is missing its durable transcript and cannot be resumed"
                    .to_string(),
            )
        }
        None => None,
    };
    let session_id = format!(
        "agent-chat-{}",
        runtime.next_id.fetch_add(1, Ordering::Relaxed)
    );
    let channel = Arc::new(AgentChatEventSink::new(channel));
    let attachment_token = channel.attachment_token()?;
    let session = Arc::new(AgentChatSession {
        provider: "claude".to_string(),
        cwd: cwd.clone(),
        native_id: Arc::new(Mutex::new(native_session_id)),
        channel: Arc::clone(&channel),
        cancel_requested: Arc::new(AtomicBool::new(false)),
        backend: AgentChatBackend::Claude {
            cwd,
            child: Arc::new(Mutex::new(None)),
            history: Arc::new(Mutex::new(Vec::new())),
        },
    });
    runtime
        .sessions
        .write()
        .map_err(|_| "agent chat state lock poisoned".to_string())?
        .insert(session_id.clone(), Arc::clone(&session));
    spawn_claude_turn(runtime.clone(), session_id.clone(), session, prompt, model)?;
    Ok(AgentChatStartResult {
        session_id,
        attachment_token,
    })
}

pub(crate) fn start_print(
    runtime: &AgentChatRuntime,
    provider: &str,
    cwd: std::path::PathBuf,
    prompt: String,
    native_session_id: Option<String>,
    model: Option<String>,
    channel: Channel<AgentChatEvent>,
) -> Result<AgentChatStartResult, String> {
    let native_session_id = match native_session_id {
        Some(id) if native_session_path(provider, &id).is_some() => Some(id),
        Some(_) => {
            return Err(format!(
                "Saved {provider} session is missing its durable transcript and cannot be resumed"
            ));
        }
        None => None,
    };
    let session_id = format!(
        "agent-chat-{}",
        runtime.next_id.fetch_add(1, Ordering::Relaxed)
    );
    let channel = Arc::new(AgentChatEventSink::new(channel));
    let attachment_token = channel.attachment_token()?;
    let session = Arc::new(AgentChatSession {
        provider: provider.to_string(),
        cwd: cwd.clone(),
        native_id: Arc::new(Mutex::new(native_session_id.clone())),
        channel: Arc::clone(&channel),
        cancel_requested: Arc::new(AtomicBool::new(false)),
        backend: AgentChatBackend::Print {
            provider: provider.to_string(),
            cwd,
            child: Arc::new(Mutex::new(None)),
            history: Arc::new(Mutex::new(Vec::new())),
        },
    });
    runtime
        .sessions
        .write()
        .map_err(|_| "agent chat state lock poisoned".to_string())?
        .insert(session_id.clone(), Arc::clone(&session));
    spawn_print_turn(
        runtime.clone(),
        session_id.clone(),
        session,
        prompt,
        native_session_id,
        model,
    )?;
    Ok(AgentChatStartResult {
        session_id,
        attachment_token,
    })
}
