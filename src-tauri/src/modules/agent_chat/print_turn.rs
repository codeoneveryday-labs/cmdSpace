use super::{
    adapter::{build_launch, parse_structured_line, AdapterKind},
    agent_turn_events_include_done,
    claude::build_contextual_prompt,
    command_code_result_session_id,
    events::AgentChatEvent,
    native_session_path, providers,
    runtime::{AgentChatBackend, AgentChatProviderExit, AgentChatRuntime, AgentChatSession},
    send_event,
    sessions::should_emit_exit_error,
};
use serde_json::Value;
use shared_child::SharedChild;
use std::{
    io::{BufRead, BufReader, Read},
    process::{Command, Stdio},
    sync::{atomic::Ordering, Arc},
    thread,
};

pub(crate) fn spawn_print_turn(
    runtime: AgentChatRuntime,
    session_id: String,
    session: Arc<AgentChatSession>,
    prompt: String,
    native_session_id: Option<String>,
    model: Option<String>,
) -> Result<(), String> {
    let AgentChatBackend::Print {
        provider,
        cwd,
        child,
        history,
    } = &session.backend
    else {
        return Err("agent chat session is not a print adapter".to_string());
    };
    let provider = provider.clone();
    let cwd = cwd.clone();
    let child = Arc::clone(child);
    let history = Arc::clone(history);
    let native_id = Arc::clone(&session.native_id);
    session.cancel_requested.store(false, Ordering::Relaxed);
    let cancel_requested = Arc::clone(&session.cancel_requested);
    let effective_native_session_id =
        native_session_id.or_else(|| native_id.lock().ok().and_then(|stored| stored.clone()));
    let contextual_prompt = if effective_native_session_id.is_some() {
        prompt.clone()
    } else {
        let history = history
            .lock()
            .map_err(|_| "agent history lock poisoned".to_string())?;
        build_contextual_prompt(&history, &prompt)
    };
    history
        .lock()
        .map_err(|_| "agent history lock poisoned".to_string())?
        .push(("user".to_string(), prompt));
    let launch = build_launch(&provider, &cwd).map_err(|error| error.to_string())?;
    let mut command = Command::new(&launch.program);
    command.args(&launch.args);
    if let Some(native_session_id) = effective_native_session_id {
        if launch.adapter == AdapterKind::CommandCodeJson {
            command.arg("--resume").arg(native_session_id);
        } else if let Some(path) = native_session_path(&provider, &native_session_id) {
            command.arg("--session").arg(path);
        }
    }
    if let Some(model) = model.filter(|model| model != "default") {
        match launch.adapter {
            AdapterKind::GeminiStreamJson | AdapterKind::CommandCodeJson => {
                command.arg("--model").arg(model);
            }
            AdapterKind::OpenCodeJson => {
                command.arg("-m").arg(model);
            }
            _ => {}
        }
    }
    if launch.adapter == AdapterKind::CommandCodeJson {
        command.arg("-p").arg(&contextual_prompt);
    } else {
        command.arg(&contextual_prompt);
    }
    command
        .current_dir(&launch.cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut command);
    let spawned = Arc::new(SharedChild::spawn(&mut command).map_err(|error| {
        format!(
            "Failed to launch the {provider} CLI ({program}). Is it installed and on PATH? {error}",
            program = launch.program
        )
    })?);
    let stdout = spawned
        .take_stdout()
        .ok_or_else(|| format!("{provider} structured stdout unavailable"))?;
    let stderr = spawned
        .take_stderr()
        .ok_or_else(|| format!("{provider} structured stderr unavailable"))?;
    *child
        .lock()
        .map_err(|_| "agent child lock poisoned".to_string())? = Some(Arc::clone(&spawned));
    let channel = Arc::clone(&session.channel);
    let history = Arc::clone(&history);
    let child_slot = Arc::clone(&child);
    let adapter = launch.adapter;
    let session_cwd = cwd.clone();
    let child_for_wait = Arc::clone(&spawned);
    let stderr_handle = thread::Builder::new()
        .name(format!("cmdspace-agent-chat-{provider}-stderr"))
        .spawn(move || {
            let mut stderr_text = String::new();
            let _ = BufReader::new(stderr).read_to_string(&mut stderr_text);
            stderr_text
        })
        .map_err(|error| error.to_string())?;
    thread::Builder::new().name(format!("cmdspace-agent-chat-{provider}")).spawn(move || {
        let mut saw_done = false;
        let mut command_code_session_id = None;
        let mut command_code_run_end = None;
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if adapter == AdapterKind::CommandCodeJson {
                command_code_session_id = command_code_result_session_id(&line)
                    .or(command_code_session_id);
                if serde_json::from_str::<Value>(&line)
                    .ok()
                    .and_then(|value| value.pointer("/event/type").and_then(Value::as_str).map(str::to_string))
                    .as_deref()
                    == Some("run_end")
                {
                    command_code_run_end = Some(line.clone());
                }
            }
            for event in parse_structured_line(adapter, &line) {
                if agent_turn_events_include_done(std::slice::from_ref(&event)) {
                    saw_done = true;
                }
                if let AgentChatEvent::Session { native_id: event_native_id } = &event { if let Ok(mut stored) = native_id.lock() { *stored = Some(event_native_id.clone()); } }
                if let AgentChatEvent::Assistant { text } = &event { if let Ok(mut history) = history.lock() { history.push(("assistant".to_string(), text.clone())); } }
                send_event(&channel, event);
            }
        }
        let status = child_for_wait.wait();
        let stderr_text = stderr_handle.join().unwrap_or_default();
        if let Ok(status) = status {
            if !status.success()
                && should_emit_exit_error(cancel_requested.load(Ordering::Relaxed), false)
            {
                let message = if !stderr_text.trim().is_empty() {
                    Some(stderr_text.trim().to_string())
                } else if adapter == AdapterKind::CommandCodeJson {
                    providers::cmd::headless_exit_message(status.code()).map(str::to_string)
                } else {
                    None
                };
                if let Some(message) = message {
                    send_event(&channel, AgentChatEvent::Error { message });
                }
            }
            if status.success() && adapter == AdapterKind::CommandCodeJson {
                let committed_id = match command_code_run_end
                    .as_deref()
                    .map(|line| providers::cmd::materialize_headless_transcript(&session_cwd, line))
                    .transpose()
                {
                    Ok(session_id) => session_id.flatten().or(command_code_session_id),
                    Err(error) => {
                        send_event(&channel, AgentChatEvent::Error { message: error });
                        None
                    }
                }
                .or_else(|| {
                    native_id.lock().ok().and_then(|stored| stored.clone())
                });
                match committed_id.filter(|id| native_session_path("cmd", id).is_some()) {
                    Some(native_id_value) => {
                        if let Ok(mut stored) = native_id.lock() {
                            *stored = Some(native_id_value.clone());
                        }
                        send_event(&channel, AgentChatEvent::Session { native_id: native_id_value });
                    }
                    None => send_event(
                        &channel,
                        AgentChatEvent::Error {
                            message: "Command Code completed without a durable session transcript; this chat cannot be resumed.".to_string(),
                        },
                    ),
                }
            }
        } else if !stderr_text.trim().is_empty()
            && should_emit_exit_error(cancel_requested.load(Ordering::Relaxed), false)
        {
            send_event(&channel, AgentChatEvent::Error { message: stderr_text.trim().to_string() });
        }
        if let Ok(mut child) = child_slot.lock() {
            if child.as_ref().is_some_and(|current| Arc::ptr_eq(current, &spawned)) {
                *child = None;
            }
        }
        if let Err(error) = runtime.handle_provider_exit(&session_id, AgentChatProviderExit::PerTurn) {
            log::warn!("failed to finalize completed {provider} turn session={session_id}: {error}");
        }
        if adapter == AdapterKind::CommandCodeJson || !saw_done {
            send_event(&channel, AgentChatEvent::Done);
        }
    }).map_err(|error| error.to_string())?;
    Ok(())
}
