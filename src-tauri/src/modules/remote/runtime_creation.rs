use super::super::{db, remote_auth::now_unix_seconds};
use super::http::request_body;
use super::runtime::spawn_remote_terminal;
use super::runtime_cwd::{authorize_remote_cwd, resolve_remote_session_cwd};
use super::sessions::RemoteRuntime;
use std::sync::{Arc, Mutex};

pub(super) fn create_remote_session(
    request: &[u8],
    runtime: &Arc<Mutex<RemoteRuntime>>,
) -> Result<String, String> {
    #[derive(serde::Deserialize)]
    struct Input {
        cwd: Option<String>,
    }
    let input: Input = serde_json::from_str(request_body(request)).map_err(|e| e.to_string())?;
    let cwd = input.cwd.filter(|value| !value.trim().is_empty());
    let cwd = authorize_remote_cwd(cwd.as_deref())?;
    let session = spawn_remote_terminal(cwd, None, None)?;
    let mut guard = runtime
        .lock()
        .map_err(|_| "remote runtime poisoned".to_string())?;
    let id = guard.next_id;
    guard.next_id = guard.next_id.saturating_add(1);
    guard.sessions.insert(id, session);
    Ok(serde_json::json!({"id": id, "cols": 120, "rows": 40}).to_string())
}

pub(super) fn create_mobile_workspace(
    runtime: &Arc<Mutex<RemoteRuntime>>,
    device_id: &str,
    workspace_id: String,
    name: String,
    working_folder: String,
    terminal_count: u8,
) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 80 {
        return Err("workspace name must be between 1 and 80 characters".to_string());
    }
    if workspace_id.is_empty() || workspace_id.len() > 96 {
        return Err("workspace id is invalid".to_string());
    }
    if !(1..=12).contains(&terminal_count) {
        return Err("terminal count must be between 1 and 12".to_string());
    }
    let working_folder = resolve_remote_session_cwd(Some(&working_folder), None)?
        .ok_or_else(|| "workspace requires a working directory".to_string())?;
    let conn = db::init_db()?;
    if db::mobile_workspace_id_exists_inner(&conn, &workspace_id)? {
        return Err("mobile workspace already exists".to_string());
    }
    let now = now_unix_seconds() as i64;
    let workspace = db::MobileWorkspaceRow {
        id: workspace_id.clone(),
        owner_device_id: device_id.to_string(),
        name: name.to_string(),
        working_folder: working_folder.clone(),
        created_at: now,
        updated_at: now,
    };
    db::save_mobile_workspace_inner(&conn, &workspace)?;

    let mut guard = runtime
        .lock()
        .map_err(|_| "remote runtime poisoned".to_string())?;
    for _ in 0..terminal_count {
        let session = spawn_remote_terminal(
            Some(working_folder.clone()),
            Some(workspace_id.clone()),
            Some(device_id.to_string()),
        )?;
        let id = guard.next_id;
        guard.next_id = guard.next_id.saturating_add(1);
        guard.sessions.insert(id, session);
    }
    Ok(())
}

/// Browser remote access keeps its pre-existing desktop-workspace behaviour.
/// Native iOS calls `create_mobile_workspace` instead, so the two workspace
/// namespaces never meet.
pub(super) fn create_remote_workspace(
    runtime: &Arc<Mutex<RemoteRuntime>>,
    workspace_id: String,
    name: String,
    working_folder: String,
    terminal_count: u8,
) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 80 {
        return Err("workspace name must be between 1 and 80 characters".to_string());
    }
    if workspace_id.is_empty() || workspace_id.len() > 96 {
        return Err("workspace id is invalid".to_string());
    }
    if !(1..=12).contains(&terminal_count) {
        return Err("terminal count must be between 1 and 12".to_string());
    }
    let working_folder = resolve_remote_session_cwd(Some(&working_folder), None)?
        .ok_or_else(|| "workspace requires a working directory".to_string())?;
    let conn = db::init_db()?;
    if db::list_workspaces_inner(&conn)?
        .iter()
        .any(|workspace| workspace.id == workspace_id)
    {
        return Err("workspace already exists".to_string());
    }
    let now = now_unix_seconds() as i64;
    let workspace = db::WorkspaceRow {
        id: workspace_id.clone(),
        name: name.to_string(),
        count: i32::from(terminal_count),
        accent_color: None,
        working_folder: Some(working_folder.clone()),
        created_at: now,
        updated_at: now,
        display_order: db::list_workspaces_inner(&conn)?.len() as i32,
        pane_layout: None,
        workspace_mode: Some("terminal".to_string()),
        agent_provider: None,
        agent_session_id: None,
        agent_providers: None,
        agent_session_ids: None,
        agent_chat_ids: None,
    };
    db::save_workspace_inner(&conn, &workspace)?;
    for pane_index in 0..terminal_count {
        db::save_pane_inner(
            &conn,
            &db::WorkspacePaneRow {
                workspace_id: workspace_id.clone(),
                pane_index: i32::from(pane_index),
                working_folder: Some(working_folder.clone()),
                last_command: None,
                auto_launch: false,
                agent_provider: None,
                native_session_id: None,
            },
        )?;
    }
    let mut guard = runtime
        .lock()
        .map_err(|_| "remote runtime poisoned".to_string())?;
    for _ in 0..terminal_count {
        let session = spawn_remote_terminal(
            Some(working_folder.clone()),
            Some(workspace_id.clone()),
            None,
        )?;
        let id = guard.next_id;
        guard.next_id = guard.next_id.saturating_add(1);
        guard.sessions.insert(id, session);
    }
    Ok(())
}
