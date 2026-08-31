use super::{
    events::AgentChatEvent,
    runtime::{AgentChatBackend, AgentChatRuntime, AgentChatSession},
    sessions::{spawn_claude_turn, spawn_print_turn},
};
use serde_json::Value;
use std::{
    io::Write,
    process::ChildStdin,
    sync::{atomic::Ordering, Arc, Mutex},
};

pub(crate) fn write_json(writer: &Arc<Mutex<ChildStdin>>, value: &Value) -> Result<(), String> {
    let mut writer = writer
        .lock()
        .map_err(|_| "agent chat writer lock poisoned".to_string())?;
    serde_json::to_writer(&mut *writer, value).map_err(|error| error.to_string())?;
    writer.write_all(b"\n").map_err(|error| error.to_string())?;
    writer.flush().map_err(|error| error.to_string())
}

/// A cancelled turn may report a provider exit error as interrupt fallout.
pub(crate) fn cancel_window_suppresses_error(
    session: &AgentChatSession,
    event: &AgentChatEvent,
) -> bool {
    matches!(event, AgentChatEvent::Error { .. })
        && session.cancel_requested.load(Ordering::Relaxed)
}

pub(crate) fn stop_session(session: &AgentChatSession) -> Result<(), String> {
    match &session.backend {
        AgentChatBackend::Codex { child, .. } => {
            child.kill().map_err(|error| error.to_string())?;
            child.wait().map_err(|error| error.to_string())?;
        }
        AgentChatBackend::Claude { child, .. } | AgentChatBackend::Print { child, .. } => {
            if let Some(child) = child
                .lock()
                .map_err(|_| "agent child lock poisoned".to_string())?
                .clone()
            {
                child.kill().map_err(|error| error.to_string())?;
                child.wait().map_err(|error| error.to_string())?;
            }
        }
        AgentChatBackend::Omp { child, .. } => {
            child.kill().map_err(|error| error.to_string())?;
            child.wait().map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

pub(crate) fn cancel_session(session: &AgentChatSession) -> Result<(), String> {
    session.cancel_requested.store(true, Ordering::Relaxed);
    match &session.backend {
        AgentChatBackend::Codex {
            writer, protocol, ..
        } => {
            let message = protocol
                .lock()
                .map_err(|_| "Codex protocol lock poisoned".to_string())?
                .cancel_turn();
            match message {
                Ok(Some(message)) => write_json(writer, &message),
                Ok(None) => Ok(()),
                Err(error) => {
                    log::debug!("Codex cancel ignored: {error}");
                    Ok(())
                }
            }
        }
        AgentChatBackend::Claude { child, .. } => {
            let child = child
                .lock()
                .map_err(|_| "Claude child lock poisoned".to_string())?
                .clone();
            match child {
                Some(child) => child.kill().map_err(|error| error.to_string()),
                None => Ok(()),
            }
        }
        AgentChatBackend::Omp { writer, .. } => write_json(
            writer,
            &serde_json::json!({ "id": "abort", "type": "abort" }),
        ),
        AgentChatBackend::Print { child, .. } => {
            if let Some(child) = child
                .lock()
                .map_err(|_| "agent child lock poisoned".to_string())?
                .clone()
            {
                child.kill().map_err(|error| error.to_string())?;
            }
            Ok(())
        }
    }
}

pub(crate) fn send_message(
    runtime: &AgentChatRuntime,
    session_id: &str,
    session: &Arc<AgentChatSession>,
    prompt: String,
    model: Option<String>,
) -> Result<(), String> {
    log::debug!(
        "agent chat follow-up provider={} cwd={}",
        session.provider,
        session.cwd.display()
    );
    match &session.backend {
        AgentChatBackend::Codex {
            writer, protocol, ..
        } => {
            session.cancel_requested.store(false, Ordering::Relaxed);
            let message = protocol
                .lock()
                .map_err(|_| "Codex protocol lock poisoned".to_string())?
                .start_turn(&prompt, model.as_deref())?;
            write_json(writer, &message)
        }
        AgentChatBackend::Claude { child, .. } => {
            if child
                .lock()
                .map_err(|_| "Claude child lock poisoned".to_string())?
                .is_some()
            {
                return Err("Claude is still responding".to_string());
            }
            spawn_claude_turn(
                runtime.clone(),
                session_id.to_string(),
                Arc::clone(session),
                prompt,
                model,
            )
        }
        AgentChatBackend::Omp { writer, .. } => {
            session.cancel_requested.store(false, Ordering::Relaxed);
            if let Some(model) = model.filter(|model| model != "default") {
                write_json(
                    writer,
                    &serde_json::json!({ "id": "model", "type": "set_model", "provider": "", "modelId": model }),
                )?;
            }
            write_json(
                writer,
                &serde_json::json!({ "id": "follow-up", "type": "prompt", "message": prompt }),
            )
        }
        AgentChatBackend::Print { child, .. } => {
            if child
                .lock()
                .map_err(|_| "agent child lock poisoned".to_string())?
                .is_some()
            {
                return Err("Agent is still responding".to_string());
            }
            spawn_print_turn(
                runtime.clone(),
                session_id.to_string(),
                Arc::clone(session),
                prompt,
                None,
                model,
            )
        }
    }
}
