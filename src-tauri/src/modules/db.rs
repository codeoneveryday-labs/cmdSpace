use rusqlite::Connection;
use std::sync::Mutex;

mod error;
pub use error::{DbError, DbResult};

pub struct DbState(pub Mutex<Connection>);

mod models;
pub use models::*;

mod schema;
#[cfg(test)]
use schema::{get_db_path, migrate_workspace_panes, migrate_workspace_setup_preferences};
#[allow(unused_imports)]
pub use schema::{init_db, init_mobile_workspace_schema};
#[cfg(test)]
pub(crate) fn initialize_schema(conn: &rusqlite::Connection) -> DbResult<()> {
    schema::initialize_schema(conn)
}
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
pub fn db_list_workspaces(state: tauri::State<'_, DbState>) -> DbResult<Vec<WorkspaceDto>> {
    let conn = state.0.lock().map_err(|_| DbError::MutexPoisoned)?;
    list_workspaces_inner(&conn).map(|rows| rows.into_iter().map(WorkspaceDto::from).collect())
}

#[tauri::command]
pub fn db_save_workspace(
    state: tauri::State<'_, DbState>,
    workspace: WorkspaceDto,
) -> DbResult<()> {
    let conn = state.0.lock().map_err(|_| DbError::MutexPoisoned)?;
    save_workspace_inner(&conn, &WorkspaceRow::from(workspace))
}

#[tauri::command]
pub fn db_delete_workspace(state: tauri::State<'_, DbState>, id: String) -> DbResult<()> {
    let conn = state.0.lock().map_err(|_| DbError::MutexPoisoned)?;
    delete_workspace_inner(&conn, &id)
}

#[tauri::command]
pub fn db_reorder_workspaces(
    state: tauri::State<'_, DbState>,
    orders: Vec<(String, i32)>,
) -> DbResult<()> {
    let mut conn = state.0.lock().map_err(|_| DbError::MutexPoisoned)?;
    reorder_workspaces_inner(&mut conn, &orders)
}

#[tauri::command]
pub fn db_list_panes(
    state: tauri::State<'_, DbState>,
    workspace_id: String,
) -> DbResult<Vec<WorkspacePaneRow>> {
    let conn = state.0.lock().map_err(|_| DbError::MutexPoisoned)?;
    list_panes_inner(&conn, &workspace_id)
}

#[tauri::command]
pub fn db_save_pane(state: tauri::State<'_, DbState>, pane: WorkspacePaneRow) -> DbResult<()> {
    let conn = state.0.lock().map_err(|_| DbError::MutexPoisoned)?;
    save_pane_inner(&conn, &pane)
}

#[tauri::command]
pub fn db_list_recent_workspaces(
    state: tauri::State<'_, DbState>,
) -> DbResult<Vec<RecentWorkspaceRow>> {
    let conn = state.0.lock().map_err(|_| DbError::MutexPoisoned)?;
    list_recent_workspaces_inner(&conn)
}

#[tauri::command]
pub fn db_save_recent_workspace(
    state: tauri::State<'_, DbState>,
    workspace: RecentWorkspaceRow,
) -> DbResult<()> {
    let conn = state.0.lock().map_err(|_| DbError::MutexPoisoned)?;
    save_recent_workspace_inner(&conn, &workspace)
}

#[tauri::command]
pub fn db_load_workspace_setup_custom_command(
    state: tauri::State<'_, DbState>,
) -> DbResult<String> {
    let conn = state.0.lock().map_err(|_| DbError::MutexPoisoned)?;
    load_workspace_setup_custom_command_inner(&conn)
}

#[tauri::command]
pub fn db_save_workspace_setup_custom_command(
    state: tauri::State<'_, DbState>,
    command: String,
) -> DbResult<()> {
    let conn = state.0.lock().map_err(|_| DbError::MutexPoisoned)?;
    save_workspace_setup_custom_command_inner(&conn, &command)
}

#[cfg(test)]
mod tests;
