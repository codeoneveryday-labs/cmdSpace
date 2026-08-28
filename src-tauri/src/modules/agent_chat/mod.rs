pub mod adapter;
pub mod codex;
pub mod claude;
pub mod events;
pub mod models;
pub mod providers;

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
        let protocol = Arc::new(Mutex::new(match native_session_id.filter(|id| native_session_path("codex", id).is_some()) {
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
                    if protocol.thread_id().is_some()
                        && initial_prompt.as_deref().is_some_and(|prompt| !prompt.is_empty())
                    {
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
        native_session_id: Option<String>,
        model: Option<String>,
        channel: Channel<AgentChatEvent>,
    ) -> Result<AgentChatStartResult, String> {
        let native_session_id = match native_session_id {
            Some(id) if native_session_path("claude", &id).is_some() => Some(id),
            Some(_) => return Err("Saved Claude session is missing its durable transcript and cannot be resumed".to_string()),
            None => None,
        };
        let session_id = format!(
            "agent-chat-{}",
            self.next_id.fetch_add(1, Ordering::Relaxed)
        );
        let session = Arc::new(AgentChatSession {
            provider: "claude".to_string(),
            cwd: cwd.clone(),
            native_id: Arc::new(Mutex::new(native_session_id)),
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
                    if !prompt.is_empty() {
                        let _ = write_json(&writer_for_reader, &serde_json::json!({ "id": "initial", "type": "prompt", "message": prompt }));
                    }
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
        let session_id = format!("agent-chat-{}", self.next_id.fetch_add(1, Ordering::Relaxed));
        let session = Arc::new(AgentChatSession {
            provider: provider.to_string(), cwd: cwd.clone(), native_id: Arc::new(Mutex::new(native_session_id.clone())), channel: Arc::new(Mutex::new(channel)),
            backend: AgentChatBackend::Print { provider: provider.to_string(), cwd, child: Arc::new(Mutex::new(None)), history: Arc::new(Mutex::new(Vec::new())) },
        });
        self.sessions.write().map_err(|_| "agent chat state lock poisoned".to_string())?.insert(session_id.clone(), Arc::clone(&session));
        spawn_print_turn(session, prompt, native_session_id, model)?;
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
    let native_session_id = session
        .native_id
        .lock()
        .map_err(|_| "Claude native session lock poisoned".to_string())?
        .clone();
    let contextual_prompt = if native_session_id.is_some() {
        prompt.clone()
    } else {
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
        .args(native_session_id.map(|id| vec!["--resume".to_string(), id]).unwrap_or_default())
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

fn spawn_print_turn(session: Arc<AgentChatSession>, prompt: String, native_session_id: Option<String>, model: Option<String>) -> Result<(), String> {
    let AgentChatBackend::Print { provider, cwd, child, history } = &session.backend else { return Err("agent chat session is not a print adapter".to_string()); };
    let provider = provider.clone();
    let cwd = cwd.clone();
    let child = Arc::clone(child);
    let history = Arc::clone(history);
    let native_id = Arc::clone(&session.native_id);
    let effective_native_session_id = native_session_id.or_else(|| {
        native_id.lock().ok().and_then(|stored| stored.clone())
    });
    let contextual_prompt = if effective_native_session_id.is_some() {
        prompt.clone()
    } else {
        let history = history.lock().map_err(|_| "agent history lock poisoned".to_string())?;
        build_contextual_prompt(&history, &prompt)
    };
    history.lock().map_err(|_| "agent history lock poisoned".to_string())?.push(("user".to_string(), prompt));
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
            AdapterKind::GeminiStreamJson | AdapterKind::CommandCodeJson => { command.arg("--model").arg(model); }
            AdapterKind::OpenCodeJson => { command.arg("-m").arg(model); }
            _ => {}
        }
    }
    if launch.adapter == AdapterKind::CommandCodeJson {
        command.arg("-p").arg(&contextual_prompt);
    } else {
        command.arg(&contextual_prompt);
    }
    command.current_dir(&launch.cwd).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut command);
    let spawned = Arc::new(SharedChild::spawn(&mut command).map_err(|error| error.to_string())?);
    let stdout = spawned.take_stdout().ok_or_else(|| format!("{provider} structured stdout unavailable"))?;
    let stderr = spawned.take_stderr().ok_or_else(|| format!("{provider} structured stderr unavailable"))?;
    *child.lock().map_err(|_| "agent child lock poisoned".to_string())? = Some(Arc::clone(&spawned));
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
            if !status.success() {
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
        } else if !stderr_text.trim().is_empty() {
            send_event(&channel, AgentChatEvent::Error { message: stderr_text.trim().to_string() });
        }
        if let Ok(mut child) = child_slot.lock() {
            if child.as_ref().is_some_and(|current| Arc::ptr_eq(current, &spawned)) {
                *child = None;
            }
        }
        if adapter == AdapterKind::CommandCodeJson || !saw_done {
            send_event(&channel, AgentChatEvent::Done);
        }
    }).map_err(|error| error.to_string())?;
    Ok(())
}

fn command_code_result_session_id(line: &str) -> Option<String> {
    let value = serde_json::from_str::<Value>(line).ok()?;
    (value.get("type").and_then(Value::as_str) == Some("result"))
        .then(|| value.get("sessionId").and_then(Value::as_str).map(str::to_string))
        .flatten()
}

fn native_session_path(provider: &str, session_id: &str) -> Option<std::path::PathBuf> {
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
        AdapterKind::ClaudeJson => state.start_claude(cwd, prompt, native_session_id, model, on_event),
        AdapterKind::OmpRpc => state.start_omp(cwd, prompt, model, on_event),
        AdapterKind::GeminiStreamJson | AdapterKind::OpenCodeJson | AdapterKind::CommandCodeJson => state.start_print(&provider, cwd, prompt, native_session_id, model, on_event),
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
            spawn_print_turn(session, prompt, None, model)
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
            child.kill().map_err(|error| error.to_string())?;
            child.wait().map_err(|error| error.to_string())?;
            Ok(())
        }
        AgentChatBackend::Claude { child, .. } => {
            if let Some(child) = child
                .lock()
                .map_err(|_| "Claude child lock poisoned".to_string())?
                .clone()
            {
                child.kill().map_err(|error| error.to_string())?;
                child.wait().map_err(|error| error.to_string())?;
            }
            Ok(())
        }
        AgentChatBackend::Omp { child, .. } => {
            child.kill().map_err(|error| error.to_string())?;
            child.wait().map_err(|error| error.to_string())?;
            Ok(())
        }
        AgentChatBackend::Print { child, .. } => {
            if let Some(child) = child.lock().map_err(|_| "agent child lock poisoned".to_string())?.clone() {
                child.kill().map_err(|error| error.to_string())?;
                child.wait().map_err(|error| error.to_string())?;
            }
            Ok(())
        }
    }
}

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
    if provider != "codex" && provider != "claude" && provider != "cmd" {
        return Ok(Vec::new());
    }
    if native_session_id.len() > 100
        || !native_session_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("Invalid native agent session id".to_string());
    }
    let Some(home) = dirs::home_dir() else {
        return Ok(Vec::new());
    };
    let sessions_dir = if provider == "codex" {
        home.join(".codex").join("sessions")
    } else if provider == "claude" {
        home.join(".claude").join("projects")
    } else {
        home.join(".commandcode").join("projects")
    };
    if !sessions_dir.is_dir() {
        return Ok(Vec::new());
    }
    let Some(path) = find_native_session_file(&sessions_dir, &native_session_id)? else {
        return Ok(Vec::new());
    };
    let contents = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    Ok(parse_native_history(&provider, &contents))
}

pub(crate) fn parse_native_history(provider: &str, contents: &str) -> Vec<AgentChatEvent> {
    let mut events = Vec::new();
    for line in contents.lines() {
        let Ok(value) = serde_json::from_str::<Value>(line) else { continue };
        if provider == "codex" {
            let Some(payload) = value.get("payload") else { continue };
            if value.get("type").and_then(Value::as_str) != Some("event_msg") { continue; }
            match payload.get("type").and_then(Value::as_str) {
                Some("user_message") => if let Some(text) = payload.get("message").and_then(Value::as_str) { events.push(AgentChatEvent::User { text: text.to_string() }); },
                Some("agent_message")
                    if payload.get("phase").and_then(Value::as_str) == Some("final_answer") =>
                {
                    // Codex persists orchestration commentary alongside the
                    // user-facing final answer. Only replay final answers;
                    // internal routing/progress text must never appear in chat.
                    if let Some(text) = payload.get("message").and_then(Value::as_str) {
                        events.push(AgentChatEvent::Assistant { text: text.to_string() });
                    }
                }
                _ => {}
            }
        } else if provider == "claude" {
            let role = value
                .pointer("/message/role")
                .or_else(|| value.pointer("/role"))
                .and_then(Value::as_str);
            let text = value
                .pointer("/message/content")
                .or_else(|| value.pointer("/content"))
                .and_then(|content| {
                    content.as_str().map(str::to_string).or_else(|| {
                        content.as_array().and_then(|parts| {
                            parts.iter().find_map(|part| {
                                part.get("text").and_then(Value::as_str).map(str::to_string)
                            })
                        })
                    })
            });
            if let Some(text) = text {
                match role {
                    Some("user") => events.push(AgentChatEvent::User { text }),
                    Some("assistant") => events.push(AgentChatEvent::Assistant { text }),
                    _ => {}
                }
            }
        } else if value.get("type").and_then(Value::as_str) == Some("message") {
            let role = value.get("message").and_then(|message| message.get("role")).and_then(Value::as_str);
            let text = value.get("message").and_then(|message| message.get("content")).and_then(Value::as_array).and_then(|content| content.iter().find_map(|item| item.get("text").and_then(Value::as_str)));
            if let Some(text) = text {
                if role == Some("user") { events.push(AgentChatEvent::User { text: text.to_string() }); }
                if role == Some("assistant") { events.push(AgentChatEvent::Assistant { text: text.to_string() }); }
            }
        }
    }
    events
}

fn find_native_session_file(
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
