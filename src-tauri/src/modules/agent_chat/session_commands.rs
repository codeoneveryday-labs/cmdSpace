use super::{
    adapter::AdapterKind, cancel_session, events::AgentChatEvent, send_message, AgentChatRuntime,
    AgentChatRuntimeStatus, AgentChatStartResult,
};
use crate::modules::workspace::{authorize_spawn_cwd, WorkspaceEnv, WorkspaceRegistry};
use std::cell::Cell;
use std::time::Instant;
use tauri::ipc::Channel;

#[tauri::command]
#[expect(
    clippy::too_many_arguments,
    reason = "Tauri injects managed state and the IPC channel alongside the user request fields"
)]
pub fn agent_chat_start(
    state: tauri::State<'_, AgentChatRuntime>,
    registry: tauri::State<'_, WorkspaceRegistry>,
    provider: String,
    cwd: String,
    prompt: String,
    native_session_id: Option<String>,
    model: Option<String>,
    chat_id: Option<String>,
    workspace: Option<WorkspaceEnv>,
    on_event: Channel<AgentChatEvent>,
) -> Result<AgentChatStartResult, String> {
    state.reap_idle()?;
    let lifecycle_started_at = Instant::now();
    let did_start = Cell::new(false);
    let result = state.start_or_attach(chat_id.as_deref(), on_event.clone(), || {
        did_start.set(true);
        let workspace = WorkspaceEnv::from_option(workspace);
        let cwd = authorize_spawn_cwd(&registry, Some(&cwd), &workspace)?
            .ok_or_else(|| "Agent chat requires a working folder".to_string())?;
        match state
            .validate_provider(&provider)
            .map_err(|error| error.to_string())?
        {
            AdapterKind::CodexAppServer => {
                state.start_codex(cwd, prompt, native_session_id, model, on_event)
            }
            AdapterKind::ClaudeJson => {
                state.start_claude(cwd, prompt, native_session_id, model, on_event)
            }
            AdapterKind::OmpRpc => state.start_omp(cwd, prompt, model, on_event),
            AdapterKind::GeminiStreamJson
            | AdapterKind::OpenCodeJson
            | AdapterKind::CommandCodeJson => {
                state.start_print(&provider, cwd, prompt, native_session_id, model, on_event)
            }
        }
    })?;
    let lifecycle = if did_start.get() {
        "cold start"
    } else {
        "warm attach"
    };
    let elapsed = lifecycle_started_at.elapsed();
    if did_start.get() {
        state.record_lifecycle_latency(true, elapsed);
    }
    log::debug!(
        "agent chat {lifecycle} provider={} elapsed_ms={}",
        provider,
        elapsed.as_millis()
    );
    Ok(result)
}
#[tauri::command]
pub fn agent_chat_attach(
    state: tauri::State<'_, AgentChatRuntime>,
    chat_id: String,
    on_event: Channel<AgentChatEvent>,
) -> Result<AgentChatStartResult, String> {
    state.reap_idle()?;
    let chat_id = chat_id.trim();
    if chat_id.is_empty() {
        return Err("Agent chat attach requires a chat id".to_string());
    }
    state
        .attach_chat(chat_id, on_event)?
        .ok_or_else(|| format!("No resident agent chat runtime for '{chat_id}'"))
}

#[tauri::command]
pub fn agent_chat_detach(
    state: tauri::State<'_, AgentChatRuntime>,
    chat_id: String,
    session_id: Option<String>,
    attachment_token: Option<String>,
) -> Result<(), String> {
    state.detach_chat(
        chat_id.trim(),
        session_id.as_deref(),
        attachment_token.as_deref(),
    )
}

#[tauri::command]
pub fn agent_chat_runtime_status(
    state: tauri::State<'_, AgentChatRuntime>,
) -> Result<AgentChatRuntimeStatus, String> {
    state.status()
}

#[tauri::command]
pub fn agent_chat_send(
    state: tauri::State<'_, AgentChatRuntime>,
    session_id: String,
    prompt: String,
    model: Option<String>,
    _on_event: Channel<AgentChatEvent>,
) -> Result<(), String> {
    let session = state.session(&session_id)?;
    send_message(&state, &session_id, &session, prompt, model)
}

#[tauri::command]
pub fn agent_chat_cancel(
    state: tauri::State<'_, AgentChatRuntime>,
    session_id: String,
) -> Result<(), String> {
    let session = state.session(&session_id)?;
    cancel_session(&session)
}

#[tauri::command]
pub fn agent_chat_close(
    state: tauri::State<'_, AgentChatRuntime>,
    session_id: String,
) -> Result<(), String> {
    state.close_session(&session_id)
}
