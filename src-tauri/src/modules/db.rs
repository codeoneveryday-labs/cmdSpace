use rusqlite::Connection;
use std::sync::Mutex;

pub struct DbState(pub Mutex<Connection>);

mod models;
pub use models::*;

mod schema;
#[cfg(test)]
use schema::{
    get_db_path, initialize_schema, migrate_workspace_panes, migrate_workspace_setup_preferences,
};
#[allow(unused_imports)]
pub use schema::{init_db, init_mobile_workspace_schema};
// Inner logic functions, decoupled from tauri::State for direct, easy unit testing
mod workspaces;
pub use workspaces::{
    delete_workspace_inner, list_panes_inner, list_workspaces_inner, reorder_workspaces_inner,
    save_pane_inner, save_workspace_inner,
};
mod recent;
pub use recent::{
    list_mobile_workspaces_inner, list_recent_workspaces_inner,
    load_workspace_setup_custom_command_inner, mobile_workspace_id_exists_inner,
    mobile_workspace_inner, save_mobile_workspace_inner, save_recent_workspace_inner,
    save_workspace_setup_custom_command_inner,
};
// Tauri Command wrappers
#[tauri::command]
pub fn db_list_workspaces(state: tauri::State<'_, DbState>) -> Result<Vec<WorkspaceRow>, String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    list_workspaces_inner(&conn)
}

#[tauri::command]
pub fn db_save_workspace(
    state: tauri::State<'_, DbState>,
    workspace: WorkspaceRow,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    save_workspace_inner(&conn, &workspace)
}

#[tauri::command]
pub fn db_delete_workspace(state: tauri::State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    delete_workspace_inner(&conn, &id)
}

#[tauri::command]
pub fn db_reorder_workspaces(
    state: tauri::State<'_, DbState>,
    orders: Vec<(String, i32)>,
) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    reorder_workspaces_inner(&mut conn, &orders)
}

#[tauri::command]
pub fn db_list_panes(
    state: tauri::State<'_, DbState>,
    workspace_id: String,
) -> Result<Vec<WorkspacePaneRow>, String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    list_panes_inner(&conn, &workspace_id)
}

#[tauri::command]
pub fn db_save_pane(
    state: tauri::State<'_, DbState>,
    pane: WorkspacePaneRow,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    save_pane_inner(&conn, &pane)
}

#[tauri::command]
pub fn db_list_recent_workspaces(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<RecentWorkspaceRow>, String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    list_recent_workspaces_inner(&conn)
}

#[tauri::command]
pub fn db_save_recent_workspace(
    state: tauri::State<'_, DbState>,
    workspace: RecentWorkspaceRow,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    save_recent_workspace_inner(&conn, &workspace)
}

#[tauri::command]
pub fn db_load_workspace_setup_custom_command(
    state: tauri::State<'_, DbState>,
) -> Result<String, String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    load_workspace_setup_custom_command_inner(&conn)
}

#[tauri::command]
pub fn db_save_workspace_setup_custom_command(
    state: tauri::State<'_, DbState>,
    command: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    save_workspace_setup_custom_command_inner(&conn, &command)
}

mod agent_chat;
pub use agent_chat::{
    __cmd__db_load_agent_chat_config, __cmd__db_load_agent_model_cache,
    __cmd__db_save_agent_chat_config, __cmd__db_save_agent_model_cache, db_load_agent_chat_config,
    db_load_agent_model_cache, db_save_agent_chat_config, db_save_agent_model_cache,
};
#[cfg(test)]
mod tests;
