use super::{
    adapter::{build_launch, parse_structured_line, AdapterKind},
    event_sink::AgentChatEventSink,
    events::AgentChatEvent,
    lifecycle::{cancel_window_suppresses_error, write_json},
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

pub(crate) fn start_omp(
    runtime: &AgentChatRuntime,
    cwd: std::path::PathBuf,
    prompt: String,
    model: Option<String>,
    channel: Channel<AgentChatEvent>,
) -> Result<AgentChatStartResult, String> {
    let launch = build_launch("omp", &cwd).map_err(|error| error.to_string())?;
    let mut command = Command::new(&launch.program);
    command
        .args(&launch.args)
        .current_dir(&launch.cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut command);
    let child = Arc::new(SharedChild::spawn(&mut command).map_err(|error| {
        format!("Failed to launch the omp CLI (omp). Is it installed and on PATH? {error}")
    })?);
    let stdin = child
        .take_stdin()
        .ok_or_else(|| "omp RPC stdin unavailable".to_string())?;
    let stdout = child
        .take_stdout()
        .ok_or_else(|| "omp RPC stdout unavailable".to_string())?;
    let stderr = child
        .take_stderr()
        .ok_or_else(|| "omp RPC stderr unavailable".to_string())?;
    let writer = Arc::new(Mutex::new(stdin));
    let channel = Arc::new(AgentChatEventSink::new(channel));
    let attachment_token = channel.attachment_token()?;
    let session_id = format!(
        "agent-chat-{}",
        runtime.next_id.fetch_add(1, Ordering::Relaxed)
    );
    let session = Arc::new(AgentChatSession {
        provider: "omp".to_string(),
        cwd: launch.cwd.clone(),
        native_id: Arc::new(Mutex::new(None)),
        channel: Arc::clone(&channel),
        cancel_requested: Arc::new(AtomicBool::new(false)),
        backend: AgentChatBackend::Omp {
            child: Arc::clone(&child),
            writer: Arc::clone(&writer),
        },
    });
    runtime
        .sessions
        .write()
        .map_err(|_| "agent chat state lock poisoned".to_string())?
        .insert(session_id.clone(), session);
    let session_for_reader = runtime.session(&session_id)?;
    let runtime_for_reader = runtime.clone();
    let writer_for_reader = Arc::clone(&writer);
    let model_for_reader = model.filter(|model| model != "default");
    let channel_for_reader = Arc::clone(&channel);
    let session_for_reader_id = session_id.clone();
    thread::Builder::new().name(format!("cmdspace-agent-chat-{session_id}")).spawn(move || {
            let mut initial_prompt_sent = false;
            for line in BufReader::new(stdout).lines() {
                let line = match line { Ok(line) => line, Err(error) => { send_event(&channel_for_reader, AgentChatEvent::Error { message: error.to_string() }); break; } };
                let is_ready = serde_json::from_str::<Value>(&line)
                    .ok()
                    .and_then(|value| value.get("type").and_then(Value::as_str).map(|kind| kind == "ready"))
                    .unwrap_or(false);
                if is_ready && !initial_prompt_sent {
                    initial_prompt_sent = true;
                    if let Some(model) = &model_for_reader {
                        let _ = write_json(&writer_for_reader, &serde_json::json!({ "id": "model", "type": "set_model", "provider": "", "modelId": model }));
                    }
                    if !prompt.is_empty() {
                        let _ = write_json(&writer_for_reader, &serde_json::json!({ "id": "initial", "type": "prompt", "message": prompt }));
                    }
                }
                for event in parse_structured_line(AdapterKind::OmpRpc, &line) {
                    if let AgentChatEvent::Session { native_id } = &event {
                        if let Ok(mut stored) = session_for_reader.native_id.lock() { *stored = Some(native_id.clone()); }
                    }
                    if cancel_window_suppresses_error(&session_for_reader, &event) { continue; }
                    send_event(&channel_for_reader, event);
                }
            }
            if let Err(error) = runtime_for_reader.handle_provider_exit(
                &session_for_reader_id,
                super::runtime::AgentChatProviderExit::Persistent,
            ) {
                log::warn!(
                    "failed to finalize exited omp agent chat session={session_for_reader_id}: {error}"
                );
            }
            send_event(&channel_for_reader, AgentChatEvent::Done);
            log::debug!("omp agent chat session closed: {session_for_reader_id}");
        }).map_err(|error| error.to_string())?;
    thread::Builder::new()
        .name(format!("cmdspace-agent-chat-omp-stderr-{session_id}"))
        .spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                log::debug!("omp RPC: {line}");
            }
        })
        .map_err(|error| error.to_string())?;
    Ok(AgentChatStartResult {
        session_id,
        attachment_token,
    })
}
