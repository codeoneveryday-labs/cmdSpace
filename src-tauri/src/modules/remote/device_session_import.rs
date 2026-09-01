use super::super::remote_protocol::{RemoteProtocolImportableSession, ServerMessage};
use super::device_commands::send_remote_device_event;
use super::runtime::{
    resolve_mobile_workspace_cwd, resolve_remote_session_cwd, spawn_remote_terminal,
};
use super::sessions::RemoteRuntime;
use std::{
    io::Write,
    net::TcpStream,
    sync::{Arc, Mutex},
};
use tungstenite::WebSocket;

pub fn list_browser_importable_sessions(
    workspace_id: Option<String>,
    workspace_only: bool,
) -> Result<Vec<RemoteProtocolImportableSession>, String> {
    let workspace_cwd = match (workspace_only, workspace_id) {
        (true, Some(id)) => Some(resolve_remote_session_cwd(None, Some(&id))?),
        _ => None,
    };
    super::super::pty::session_import::list_agent_sessions(Some(100), workspace_cwd.flatten())
        .map(|sessions| {
            sessions
                .into_iter()
                .map(remote_protocol_importable_session)
                .collect()
        })
        .map_err(|error| error.to_string())
}

pub fn import_browser_agent_session(
    runtime: &Arc<Mutex<RemoteRuntime>>,
    workspace_id: Option<String>,
    provider: &str,
    session_id: &str,
) -> Result<(), String> {
    let cwd = match workspace_id {
        Some(ref id) => resolve_remote_session_cwd(None, Some(id))?,
        None => Some(
            dirs::home_dir()
                .ok_or_else(|| "cannot resolve the home directory".to_string())?
                .to_string_lossy()
                .into_owned(),
        ),
    };
    let session = super::super::pty::session_import::list_agent_sessions(Some(500), None)?
        .into_iter()
        .find(|candidate| candidate.provider == provider && candidate.session_id == session_id)
        .ok_or_else(|| "session is no longer available on this desktop".to_string())?;
    if session.active {
        return Err("this session is already active on the desktop".to_string());
    }
    let command = build_agent_resume_command(provider, session_id)?;
    let terminal = spawn_remote_terminal(cwd, workspace_id, None)?;
    terminal
        .writer
        .lock()
        .map_err(|_| "writer poisoned".to_string())?
        .write_all(format!("{command}\r").as_bytes())
        .map_err(|error| error.to_string())?;
    let mut guard = runtime
        .lock()
        .map_err(|_| "remote runtime poisoned".to_string())?;
    let id = guard.next_id;
    guard.next_id = guard.next_id.saturating_add(1);
    guard.sessions.insert(id, terminal);
    Ok(())
}

pub(super) fn send_remote_device_importable_sessions(
    socket: &mut WebSocket<TcpStream>,
    device_id: &str,
    workspace_id: &str,
    workspace_only: bool,
) -> Result<(), String> {
    let workspace_cwd = workspace_only
        .then(|| resolve_mobile_workspace_cwd(device_id, workspace_id))
        .transpose()?;
    let sessions =
        super::super::pty::session_import::list_agent_sessions(Some(100), workspace_cwd)?
            .into_iter()
            .map(remote_protocol_importable_session)
            .collect();
    send_remote_device_event(socket, ServerMessage::ImportableSessions { sessions })
}

pub(super) fn remote_protocol_importable_session(
    session: super::super::pty::session_import::ImportableAgentSession,
) -> RemoteProtocolImportableSession {
    RemoteProtocolImportableSession {
        provider: session.provider.to_string(),
        session_id: session.session_id,
        cwd: session.cwd,
        title: session.title,
        preview: session.preview,
        last_activity_at: session.last_activity_at,
        active: session.active,
    }
}

pub(super) fn import_remote_agent_session(
    runtime: &Arc<Mutex<RemoteRuntime>>,
    device_id: &str,
    workspace_id: &str,
    provider: &str,
    session_id: &str,
) -> Result<(), String> {
    let cwd = resolve_mobile_workspace_cwd(device_id, workspace_id)?;
    let session = super::super::pty::session_import::list_agent_sessions(Some(500), None)?
        .into_iter()
        .find(|candidate| candidate.provider == provider && candidate.session_id == session_id)
        .ok_or_else(|| "session is no longer available on this desktop".to_string())?;
    if session.active {
        return Err("this session is already active on the desktop".to_string());
    }
    let command = build_agent_resume_command(provider, session_id)?;
    let terminal = spawn_remote_terminal(
        Some(cwd),
        Some(workspace_id.to_string()),
        Some(device_id.to_string()),
    )?;
    terminal
        .writer
        .lock()
        .map_err(|_| "writer poisoned".to_string())?
        .write_all(format!("{command}\r").as_bytes())
        .map_err(|error| error.to_string())?;
    let mut guard = runtime
        .lock()
        .map_err(|_| "remote runtime poisoned".to_string())?;
    let id = guard.next_id;
    guard.next_id = guard.next_id.saturating_add(1);
    guard.sessions.insert(id, terminal);
    Ok(())
}

pub(super) fn build_agent_resume_command(
    provider: &str,
    session_id: &str,
) -> Result<String, String> {
    let id = format!("'{}'", session_id.replace('\'', "'\"'\"'"));
    let command = match provider {
        "claude" => format!("claude --resume {id}"),
        "codex" => format!("codex resume {id}"),
        "gemini" => format!("gemini --resume {id}"),
        "opencode" => format!("opencode --session {id}"),
        "copilot" => format!("copilot --resume={id}"),
        "cursor" => format!("cursor-agent --resume {id}"),
        "aider" => format!("aider --restore-chat-history --chat-history-file {id}"),
        "pi" => format!("pi --session {id}"),
        "amp" => format!("amp threads continue {id}"),
        "cline" => format!("cline --taskId {id}"),
        "goose" => format!("goose session --resume --session-id {id}"),
        "qwen" => format!("qwen --resume {id}"),
        "kimi" => format!("kimi --session {id}"),
        "openhands" => format!("openhands --resume {id}"),
        "kiro" => format!("kiro-cli chat --resume-id {id}"),
        "grok" => format!("grok --resume {id}"),
        "herdr" => format!("herdr session attach {id}"),
        "cmd" => format!("cmd --session {id}"),
        _ => return Err("unsupported CLI provider".to_string()),
    };
    Ok(command)
}
