use super::{
    adapter::{build_launch, parse_structured_line, AdapterKind},
    claude::build_contextual_prompt,
    events::AgentChatEvent,
    runtime::{AgentChatBackend, AgentChatProviderExit, AgentChatRuntime, AgentChatSession},
    send_event,
    sessions::should_emit_exit_error,
};
use shared_child::SharedChild;
use std::{
    io::{BufRead, BufReader, Read},
    process::{Command, Stdio},
    sync::{atomic::Ordering, Arc},
    thread,
};

pub(crate) fn spawn_claude_turn(
    runtime: AgentChatRuntime,
    session_id: String,
    session: Arc<AgentChatSession>,
    prompt: String,
    model: Option<String>,
) -> Result<(), String> {
    let AgentChatBackend::Claude {
        cwd,
        child,
        history,
    } = &session.backend
    else {
        return Err("agent chat session is not Claude".to_string());
    };
    session.cancel_requested.store(false, Ordering::Relaxed);
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
        .args(
            model
                .filter(|model| model != "default")
                .map(|model| vec!["--model".to_string(), model])
                .unwrap_or_default(),
        )
        .args(
            native_session_id
                .map(|id| vec!["--resume".to_string(), id])
                .unwrap_or_default(),
        )
        .arg(contextual_prompt)
        .current_dir(&launch.cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut command);
    let spawned = Arc::new(SharedChild::spawn(&mut command).map_err(|error| {
        format!(
            "Failed to launch the Claude Code CLI (claude). Is it installed and on PATH? {error}"
        )
    })?);
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
                        send_event(
                            &channel,
                            AgentChatEvent::Error {
                                message: error.to_string(),
                            },
                        );
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
                Ok(status) if !status.success() => {
                    if should_emit_exit_error(
                        session.cancel_requested.load(Ordering::Relaxed),
                        false,
                    ) {
                        send_event(
                            &channel,
                            AgentChatEvent::Error {
                                message: if stderr_text.trim().is_empty() {
                                    format!("Claude exited with {status}")
                                } else {
                                    stderr_text.trim().to_string()
                                },
                            },
                        );
                    }
                }
                Err(error) => send_event(
                    &channel,
                    AgentChatEvent::Error {
                        message: error.to_string(),
                    },
                ),
                _ => {}
            }
            if let Ok(mut child) = child_slot.lock() {
                *child = None;
            }
            if let Err(error) =
                runtime.handle_provider_exit(&session_id, AgentChatProviderExit::PerTurn)
            {
                log::warn!(
                    "failed to finalize completed Claude turn session={session_id}: {error}"
                );
            }
            send_event(&channel, AgentChatEvent::Done);
        })
        .map_err(|error| error.to_string())?;
    Ok(())
}
