use super::{
    adapter::build_launch,
    codex::CodexProtocol,
    event_sink::AgentChatEventSink,
    events::AgentChatEvent,
    lifecycle::{cancel_window_suppresses_error, write_json},
    native_session_path,
    runtime::{AgentChatBackend, AgentChatRuntime, AgentChatSession, AgentChatStartResult},
    send_event,
};
use serde_json::Value;
use shared_child::SharedChild;
use std::{
    io::{BufRead, BufReader},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
};
use tauri::ipc::Channel;

pub(crate) fn start_codex(
    runtime: &AgentChatRuntime,
    cwd: std::path::PathBuf,
    prompt: String,
    native_session_id: Option<String>,
    model: Option<String>,
    channel: Channel<AgentChatEvent>,
) -> Result<AgentChatStartResult, String> {
    let launch = build_launch("codex", &cwd).map_err(|error| error.to_string())?;
    let mut command = Command::new(&launch.program);
    command
        .args(&launch.args)
        .current_dir(&launch.cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut command);
    let child = Arc::new(SharedChild::spawn(&mut command).map_err(|error| {
        format!("Failed to launch the Codex CLI (codex). Is it installed and on PATH? {error}")
    })?);
    let stdin = child
        .take_stdin()
        .ok_or_else(|| "Codex app-server stdin unavailable".to_string())?;
    let stdout = child
        .take_stdout()
        .ok_or_else(|| "Codex app-server stdout unavailable".to_string())?;
    let stderr = child
        .take_stderr()
        .ok_or_else(|| "Codex app-server stderr unavailable".to_string())?;
    let writer = Arc::new(Mutex::new(stdin));
    let protocol = Arc::new(Mutex::new(
        match native_session_id.filter(|id| native_session_path("codex", id).is_some()) {
            Some(thread_id) => CodexProtocol::with_resume(cwd, thread_id),
            None => CodexProtocol::new(cwd),
        },
    ));
    let channel = Arc::new(AgentChatEventSink::new(channel));
    let attachment_token = channel.attachment_token()?;

    for message in protocol
        .lock()
        .map_err(|_| "Codex protocol lock poisoned".to_string())?
        .startup_messages()
    {
        write_json(&writer, &message)?;
    }

    let session_id = format!(
        "agent-chat-{}",
        runtime.next_id.fetch_add(1, Ordering::Relaxed)
    );
    let session = Arc::new(AgentChatSession {
        provider: "codex".to_string(),
        cwd: launch.cwd.clone(),
        native_id: Arc::new(Mutex::new(None)),
        channel: Arc::clone(&channel),
        cancel_requested: Arc::new(AtomicBool::new(false)),
        backend: AgentChatBackend::Codex {
            child: Arc::clone(&child),
            writer: Arc::clone(&writer),
            protocol: Arc::clone(&protocol),
        },
    });
    runtime
        .sessions
        .write()
        .map_err(|_| "agent chat state lock poisoned".to_string())?
        .insert(session_id.clone(), session);

    let session_for_reader = runtime.session(&session_id)?;
    let runtime_for_reader = runtime.clone();
    let session_id_for_reader = session_id.clone();

    thread::Builder::new()
        .name(format!("cmdspace-agent-chat-{session_id}"))
        .spawn(move || {
            let mut initial_prompt = Some(prompt);
            for line in BufReader::new(stdout).lines() {
                let line = match line {
                    Ok(line) => line,
                    Err(error) => {
                        send_event(
                            &channel,
                            AgentChatEvent::Error {
                                message: error.to_string(),
                            },
                        );
                        break;
                    }
                };
                let value = match serde_json::from_str::<Value>(&line) {
                    Ok(value) => value,
                    Err(error) => {
                        send_event(
                            &channel,
                            AgentChatEvent::Error {
                                message: format!("invalid Codex app-server message: {error}"),
                            },
                        );
                        continue;
                    }
                };
                let mut protocol = match protocol.lock() {
                    Ok(protocol) => protocol,
                    Err(_) => break,
                };
                for event in protocol.handle_message(&value) {
                    if let AgentChatEvent::Session { native_id } = &event {
                        if let Ok(mut stored) = session_for_reader.native_id.lock() {
                            *stored = Some(native_id.clone());
                        }
                    }
                    if cancel_window_suppresses_error(&session_for_reader, &event) {
                        continue;
                    }
                    send_event(&channel, event);
                }
                if let Some(message) = protocol.take_pending_interrupt() {
                    if let Err(error) = write_json(&writer, &message) {
                        send_event(&channel, AgentChatEvent::Error { message: error });
                    }
                }
                if protocol.thread_id().is_some()
                    && initial_prompt
                        .as_deref()
                        .is_some_and(|prompt| !prompt.is_empty())
                {
                    if let Some(prompt) = initial_prompt.take() {
                        match protocol.start_turn(&prompt, model.as_deref()) {
                            Ok(message) => {
                                if let Err(error) = write_json(&writer, &message) {
                                    send_event(&channel, AgentChatEvent::Error { message: error });
                                }
                            }
                            Err(error) => {
                                send_event(&channel, AgentChatEvent::Error { message: error })
                            }
                        }
                    }
                }
            }
            if let Err(error) = runtime_for_reader
                .handle_provider_exit(&session_id_for_reader, super::runtime::AgentChatProviderExit::Persistent)
            {
                log::warn!(
                    "failed to finalize exited Codex agent chat session={session_id_for_reader}: {error}"
                );
            }
            send_event(&channel, AgentChatEvent::Done);
        })
        .map_err(|error| error.to_string())?;

    thread::Builder::new()
        .name(format!("cmdspace-agent-chat-stderr-{session_id}"))
        .spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                log::debug!("Codex app-server: {line}");
            }
        })
        .map_err(|error| error.to_string())?;

    Ok(AgentChatStartResult {
        session_id,
        attachment_token,
    })
}
