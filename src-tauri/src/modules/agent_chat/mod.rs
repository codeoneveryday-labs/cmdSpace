pub mod adapter;
pub mod codex;
pub mod claude;
pub mod events;
pub mod models;

use self::{
    adapter::{build_launch, parse_structured_line, AdapterKind},
    claude::build_contextual_prompt,
    codex::CodexProtocol,
    events::AgentChatEvent,
};
use crate::modules::workspace::{authorize_spawn_cwd, WorkspaceEnv, WorkspaceRegistry};
use serde::Serialize;
use serde_json::Value;
use shared_child::SharedChild;
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Read, Write},
    process::{ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex, RwLock,
    },
    thread,
};
use tauri::ipc::Channel;

struct AgentChatSession {
    provider: String,
    cwd: std::path::PathBuf,
    native_id: Arc<Mutex<Option<String>>>,
    channel: Arc<Mutex<Channel<AgentChatEvent>>>,
    backend: AgentChatBackend,
}

enum AgentChatBackend {
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

#[derive(Clone)]
pub struct AgentChatRuntime {
    sessions: Arc<RwLock<HashMap<String, Arc<AgentChatSession>>>>,
    next_id: Arc<AtomicU64>,
}

impl Default for AgentChatRuntime {
    fn default() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            next_id: Arc::new(AtomicU64::new(1)),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentChatStartResult {
    session_id: String,
}

fn write_json(writer: &Arc<Mutex<ChildStdin>>, value: &Value) -> Result<(), String> {
    let mut writer = writer
        .lock()
        .map_err(|_| "agent chat writer lock poisoned".to_string())?;
    serde_json::to_writer(&mut *writer, value).map_err(|error| error.to_string())?;
    writer.write_all(b"\n").map_err(|error| error.to_string())?;
    writer.flush().map_err(|error| error.to_string())
}

impl AgentChatRuntime {
    pub fn validate_provider(&self, provider: &str) -> Result<AdapterKind, adapter::AgentChatError> {
        Ok(build_launch(provider, std::path::Path::new("."))?.adapter)
    }

    fn start_codex(
        &self,
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
        let child = Arc::new(SharedChild::spawn(&mut command).map_err(|error| error.to_string())?);
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
        let protocol = Arc::new(Mutex::new(match native_session_id {
            Some(thread_id) => CodexProtocol::with_resume(cwd, thread_id),
            None => CodexProtocol::new(cwd),
        }));
        let channel = Arc::new(Mutex::new(channel));

        for message in protocol
            .lock()
            .map_err(|_| "Codex protocol lock poisoned".to_string())?
            .startup_messages()
        {
            write_json(&writer, &message)?;
        }

        let session_id = format!(
            "agent-chat-{}",
            self.next_id.fetch_add(1, Ordering::Relaxed)
        );
        let session = Arc::new(AgentChatSession {
            provider: "codex".to_string(),
            cwd: launch.cwd.clone(),
            native_id: Arc::new(Mutex::new(None)),
            channel: Arc::clone(&channel),
            backend: AgentChatBackend::Codex {
                child: Arc::clone(&child),
                writer: Arc::clone(&writer),
                protocol: Arc::clone(&protocol),
            },
        });
        self.sessions
            .write()
            .map_err(|_| "agent chat state lock poisoned".to_string())?
            .insert(session_id.clone(), session);

        let session_for_reader = self.session(&session_id)?;

        thread::Builder::new()
            .name(format!("cmdspace-agent-chat-{session_id}"))
            .spawn(move || {
                let mut initial_prompt = Some(prompt);
                for line in BufReader::new(stdout).lines() {
                    let line = match line {
                        Ok(line) => line,
                        Err(error) => {
                            send_event(&channel, AgentChatEvent::Error { message: error.to_string() });
                            break;
                        }
                    };
                    let value = match serde_json::from_str::<Value>(&line) {
                        Ok(value) => value,
                        Err(error) => {
                            send_event(&channel, AgentChatEvent::Error {
                                message: format!("invalid Codex app-server message: {error}"),
                            });
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
                        send_event(&channel, event);
                    }
                    if let Some(message) = protocol.take_pending_interrupt() {
                        if let Err(error) = write_json(&writer, &message) {
                            send_event(&channel, AgentChatEvent::Error { message: error });
                        }
                    }
                    if protocol.thread_id().is_some() {
                        if let Some(prompt) = initial_prompt.take() {
                            match protocol.start_turn(&prompt, model.as_deref()) {
                                Ok(message) => {
                                    if let Err(error) = write_json(&writer, &message) {
                                        send_event(&channel, AgentChatEvent::Error { message: error });
                                    }
                                }
                                Err(error) => send_event(
                                    &channel,
                                    AgentChatEvent::Error { message: error },
                                ),
                            }
                        }
                    }
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

        Ok(AgentChatStartResult { session_id })
    }

    fn start_claude(
        &self,
        cwd: std::path::PathBuf,
        prompt: String,
        model: Option<String>,
        channel: Channel<AgentChatEvent>,
    ) -> Result<AgentChatStartResult, String> {
        let session_id = format!(
            "agent-chat-{}",
            self.next_id.fetch_add(1, Ordering::Relaxed)
        );
        let session = Arc::new(AgentChatSession {
            provider: "claude".to_string(),
            cwd: cwd.clone(),
            native_id: Arc::new(Mutex::new(None)),
            channel: Arc::new(Mutex::new(channel)),
            backend: AgentChatBackend::Claude {
                cwd,
                child: Arc::new(Mutex::new(None)),
                history: Arc::new(Mutex::new(Vec::new())),
            },
        });
        self.sessions
            .write()
            .map_err(|_| "agent chat state lock poisoned".to_string())?
            .insert(session_id.clone(), Arc::clone(&session));
        spawn_claude_turn(session, prompt, model)?;
        Ok(AgentChatStartResult { session_id })
    }

    fn start_omp(
        &self,
        cwd: std::path::PathBuf,
        prompt: String,
        model: Option<String>,
        channel: Channel<AgentChatEvent>,
    ) -> Result<AgentChatStartResult, String> {
        let launch = build_launch("omp", &cwd).map_err(|error| error.to_string())?;
        let mut command = Command::new(&launch.program);
        command.args(&launch.args).current_dir(&launch.cwd).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        crate::modules::proc::hide_console(&mut command);
        let child = Arc::new(SharedChild::spawn(&mut command).map_err(|error| error.to_string())?);
        let stdin = child.take_stdin().ok_or_else(|| "omp RPC stdin unavailable".to_string())?;
        let stdout = child.take_stdout().ok_or_else(|| "omp RPC stdout unavailable".to_string())?;
        let stderr = child.take_stderr().ok_or_else(|| "omp RPC stderr unavailable".to_string())?;
        let writer = Arc::new(Mutex::new(stdin));
        let channel = Arc::new(Mutex::new(channel));
        let session_id = format!("agent-chat-{}", self.next_id.fetch_add(1, Ordering::Relaxed));
        let session = Arc::new(AgentChatSession {
            provider: "omp".to_string(),
            cwd: launch.cwd.clone(),
            native_id: Arc::new(Mutex::new(None)),
            channel: Arc::clone(&channel),
            backend: AgentChatBackend::Omp { child: Arc::clone(&child), writer: Arc::clone(&writer) },
        });
        self.sessions.write().map_err(|_| "agent chat state lock poisoned".to_string())?.insert(session_id.clone(), session);
        let session_for_reader = self.session(&session_id)?;
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
                    let _ = write_json(&writer_for_reader, &serde_json::json!({ "id": "initial", "type": "prompt", "message": prompt }));
                }
                for event in parse_structured_line(AdapterKind::OmpRpc, &line) {
                    if let AgentChatEvent::Session { native_id } = &event {
                        if let Ok(mut stored) = session_for_reader.native_id.lock() { *stored = Some(native_id.clone()); }
                    }
                    send_event(&channel_for_reader, event);
                }
            }
            send_event(&channel_for_reader, AgentChatEvent::Done);
            log::debug!("omp agent chat session closed: {session_for_reader_id}");
        }).map_err(|error| error.to_string())?;
        thread::Builder::new().name(format!("cmdspace-agent-chat-omp-stderr-{session_id}")).spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) { log::debug!("omp RPC: {line}"); }
        }).map_err(|error| error.to_string())?;
        Ok(AgentChatStartResult { session_id })
    }

    fn start_print(
        &self,
        provider: &str,
        cwd: std::path::PathBuf,
        prompt: String,
        model: Option<String>,
        channel: Channel<AgentChatEvent>,
    ) -> Result<AgentChatStartResult, String> {
        let session_id = format!("agent-chat-{}", self.next_id.fetch_add(1, Ordering::Relaxed));
        let session = Arc::new(AgentChatSession {
            provider: provider.to_string(), cwd: cwd.clone(), native_id: Arc::new(Mutex::new(None)), channel: Arc::new(Mutex::new(channel)),
            backend: AgentChatBackend::Print { provider: provider.to_string(), cwd, child: Arc::new(Mutex::new(None)), history: Arc::new(Mutex::new(Vec::new())) },
        });
        self.sessions.write().map_err(|_| "agent chat state lock poisoned".to_string())?.insert(session_id.clone(), Arc::clone(&session));
        spawn_print_turn(session, prompt, model)?;
        Ok(AgentChatStartResult { session_id })
    }

    fn session(&self, session_id: &str) -> Result<Arc<AgentChatSession>, String> {
        self.sessions
            .read()
            .map_err(|_| "agent chat state lock poisoned".to_string())?
            .get(session_id)
            .cloned()
            .ok_or_else(|| format!("unknown agent chat session '{session_id}'"))
    }
}

fn spawn_claude_turn(session: Arc<AgentChatSession>, prompt: String, model: Option<String>) -> Result<(), String> {
    let AgentChatBackend::Claude { cwd, child, history } = &session.backend else {
        return Err("agent chat session is not Claude".to_string());
    };
    let contextual_prompt = {
        let history = history
            .lock()
            .map_err(|_| "Claude history lock poisoned".to_string())?;
        build_contextual_prompt(&history, &prompt)
    };
    history
        .lock()
        .map_err(|_| "Claude history lock poisoned".to_string())?
        .push(("user".to_string(), prompt));

    let launch = build_launch("claude", cwd).map_err(|error| error.to_string())?;
    let mut command = Command::new(&launch.program);
    command
        .args(&launch.args)
        .args(model.filter(|model| model != "default").map(|model| vec!["--model".to_string(), model]).unwrap_or_default())
        .arg(contextual_prompt)
        .current_dir(&launch.cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut command);
    let spawned = Arc::new(SharedChild::spawn(&mut command).map_err(|error| error.to_string())?);
    let stdout = spawned
        .take_stdout()
        .ok_or_else(|| "Claude structured stdout unavailable".to_string())?;
    let stderr = spawned
        .take_stderr()
        .ok_or_else(|| "Claude structured stderr unavailable".to_string())?;
    *child
        .lock()
        .map_err(|_| "Claude child lock poisoned".to_string())? = Some(Arc::clone(&spawned));

    let channel = Arc::clone(&session.channel);
    let history = Arc::clone(history);
    let child_slot = Arc::clone(child);
    let stderr_handle = thread::Builder::new()
        .name("cmdspace-agent-chat-claude-stderr".to_string())
        .spawn(move || {
            let mut stderr_text = String::new();
            let _ = BufReader::new(stderr).read_to_string(&mut stderr_text);
            stderr_text
        })
        .map_err(|error| error.to_string())?;
    thread::Builder::new()
        .name("cmdspace-agent-chat-claude".to_string())
        .spawn(move || {
            for line in BufReader::new(stdout).lines() {
                let line = match line {
                    Ok(line) => line,
                    Err(error) => {
                        send_event(&channel, AgentChatEvent::Error { message: error.to_string() });
                        break;
                    }
                };
                for event in parse_structured_line(AdapterKind::ClaudeJson, &line) {
                    if let AgentChatEvent::Session { native_id } = &event {
                        if let Ok(mut stored) = session.native_id.lock() {
                            *stored = Some(native_id.clone());
                        }
                    }
                    if let AgentChatEvent::Assistant { text } = &event {
                        if let Ok(mut history) = history.lock() {
                            history.push(("assistant".to_string(), text.clone()));
                        }
                    }
                    send_event(&channel, event);
                }
            }
            let exit_status = spawned.wait();
            let stderr_text = stderr_handle.join().unwrap_or_default();
            match exit_status {
                Ok(status) if !status.success() => send_event(
                    &channel,
                    AgentChatEvent::Error {
                        message: if stderr_text.trim().is_empty() {
                            format!("Claude exited with {status}")
                        } else {
                            stderr_text.trim().to_string()
                        },
                    },
                ),
                Err(error) => send_event(
                    &channel,
                    AgentChatEvent::Error { message: error.to_string() },
                ),
                _ => {}
            }
            if let Ok(mut child) = child_slot.lock() {
                *child = None;
            }
            send_event(&channel, AgentChatEvent::Done);
        })
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn spawn_print_turn(session: Arc<AgentChatSession>, prompt: String, model: Option<String>) -> Result<(), String> {
    let AgentChatBackend::Print { provider, cwd, child, history } = &session.backend else { return Err("agent chat session is not a print adapter".to_string()); };
    let provider = provider.clone();
    let cwd = cwd.clone();
    let child = Arc::clone(child);
    let history = Arc::clone(history);
    let native_id = Arc::clone(&session.native_id);
    let contextual_prompt = { let history = history.lock().map_err(|_| "agent history lock poisoned".to_string())?; build_contextual_prompt(&history, &prompt) };
    history.lock().map_err(|_| "agent history lock poisoned".to_string())?.push(("user".to_string(), prompt));
    let launch = build_launch(&provider, &cwd).map_err(|error| error.to_string())?;
    let mut command = Command::new(&launch.program);
    command.args(&launch.args);
    if let Some(model) = model.filter(|model| model != "default") {
        match launch.adapter {
            AdapterKind::GeminiStreamJson | AdapterKind::CommandCodeJson => { command.arg("--model").arg(model); }
            AdapterKind::OpenCodeJson => { command.arg("-m").arg(model); }
            _ => {}
        }
    }
    command.arg(&contextual_prompt).current_dir(&launch.cwd).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut command);
    let spawned = Arc::new(SharedChild::spawn(&mut command).map_err(|error| error.to_string())?);
    let stdout = spawned.take_stdout().ok_or_else(|| format!("{provider} structured stdout unavailable"))?;
    let stderr = spawned.take_stderr().ok_or_else(|| format!("{provider} structured stderr unavailable"))?;
    *child.lock().map_err(|_| "agent child lock poisoned".to_string())? = Some(Arc::clone(&spawned));
    let channel = Arc::clone(&session.channel);
    let history = Arc::clone(&history);
    let child_slot = Arc::clone(&child);
    let adapter = launch.adapter;
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
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
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
            if !status.success() && !stderr_text.trim().is_empty() {
                send_event(&channel, AgentChatEvent::Error { message: stderr_text.trim().to_string() });
            }
        } else if !stderr_text.trim().is_empty() {
            send_event(&channel, AgentChatEvent::Error { message: stderr_text.trim().to_string() });
        }
        if let Ok(mut child) = child_slot.lock() { *child = None; }
        if !saw_done {
            send_event(&channel, AgentChatEvent::Done);
        }
    }).map_err(|error| error.to_string())?;
    Ok(())
}

pub(crate) fn agent_turn_events_include_done(events: &[AgentChatEvent]) -> bool {
    events
        .iter()
        .any(|event| matches!(event, AgentChatEvent::Done))
}

fn send_event(channel: &Arc<Mutex<Channel<AgentChatEvent>>>, event: AgentChatEvent) {
    if let Ok(channel) = channel.lock() {
        let _ = channel.send(event);
    }
}

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
    workspace: Option<WorkspaceEnv>,
    on_event: Channel<AgentChatEvent>,
) -> Result<AgentChatStartResult, String> {
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
            if native_session_id.is_some() {
                return Err("This Claude CLI version cannot resume a native session".to_string());
            }
            state.start_claude(cwd, prompt, model, on_event)
        }
        AdapterKind::OmpRpc => state.start_omp(cwd, prompt, model, on_event),
        AdapterKind::GeminiStreamJson | AdapterKind::OpenCodeJson | AdapterKind::CommandCodeJson => state.start_print(&provider, cwd, prompt, model, on_event),
    }
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
    log::debug!(
        "agent chat follow-up provider={} cwd={}",
        session.provider,
        session.cwd.display()
    );
    match &session.backend {
        AgentChatBackend::Codex { writer, protocol, .. } => {
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
            spawn_claude_turn(session, prompt, model)
        }
        AgentChatBackend::Omp { writer, .. } => {
            if let Some(model) = model.filter(|model| model != "default") {
                write_json(writer, &serde_json::json!({ "id": "model", "type": "set_model", "provider": "", "modelId": model }))?;
            }
            write_json(writer, &serde_json::json!({ "id": "follow-up", "type": "prompt", "message": prompt }))
        }
        AgentChatBackend::Print { child, .. } => {
            if child.lock().map_err(|_| "agent child lock poisoned".to_string())?.is_some() { return Err("Agent is still responding".to_string()); }
            spawn_print_turn(session, prompt, model)
        }
    }
}

#[tauri::command]
pub fn agent_chat_cancel(
    state: tauri::State<'_, AgentChatRuntime>,
    session_id: String,
) -> Result<(), String> {
    let session = state.session(&session_id)?;
    match &session.backend {
        AgentChatBackend::Codex { writer, protocol, .. } => {
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
        AgentChatBackend::Omp { writer, .. } => {
            write_json(writer, &serde_json::json!({ "id": "abort", "type": "abort" }))
        }
        AgentChatBackend::Print { child, .. } => {
            if let Some(child) = child.lock().map_err(|_| "agent child lock poisoned".to_string())?.clone() { child.kill().map_err(|error| error.to_string())?; }
            Ok(())
        }
    }
}

#[tauri::command]
pub fn agent_chat_close(
    state: tauri::State<'_, AgentChatRuntime>,
    session_id: String,
) -> Result<(), String> {
    let session = state
        .sessions
        .write()
        .map_err(|_| "agent chat state lock poisoned".to_string())?
        .remove(&session_id);
    let Some(session) = session else {
        return Ok(());
    };
    match &session.backend {
        AgentChatBackend::Codex { child, .. } => {
            child.kill().map_err(|error| error.to_string())
        }
        AgentChatBackend::Claude { child, .. } => {
            if let Some(child) = child
                .lock()
                .map_err(|_| "Claude child lock poisoned".to_string())?
                .clone()
            {
                child.kill().map_err(|error| error.to_string())?;
            }
            Ok(())
        }
        AgentChatBackend::Omp { child, .. } => child.kill().map_err(|error| error.to_string()),
        AgentChatBackend::Print { child, .. } => {
            if let Some(child) = child.lock().map_err(|_| "agent child lock poisoned".to_string())?.clone() { child.kill().map_err(|error| error.to_string())?; }
            Ok(())
        }
    }
}

#[tauri::command]
pub fn agent_chat_list_models(
    registry: tauri::State<'_, WorkspaceRegistry>,
    provider: String,
    cwd: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<Vec<models::AgentChatModel>, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let cwd = authorize_spawn_cwd(&registry, Some(&cwd), &workspace)?
        .ok_or_else(|| "Model discovery requires a working folder".to_string())?;
    models::list_models(&provider, &cwd)
}

#[tauri::command]
pub fn agent_chat_list_slash_options(
    registry: tauri::State<'_, WorkspaceRegistry>,
    provider: String,
    cwd: String,
    command: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<Vec<models::AgentChatModel>, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let cwd = authorize_spawn_cwd(&registry, Some(&cwd), &workspace)?
        .ok_or_else(|| "Agent control discovery requires a working folder".to_string())?;
    models::list_slash_options(&provider, &cwd, &command)
}
