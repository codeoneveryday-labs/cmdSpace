use super::{WorkspacePaneRow, WorkspaceRow};
use rusqlite::{params, Connection};

pub fn list_workspaces_inner(conn: &Connection) -> Result<Vec<WorkspaceRow>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, terminal_count, accent_color, working_folder, created_at, updated_at, display_order, pane_layout, workspace_mode, pinned FROM workspaces ORDER BY display_order ASC, created_at ASC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(WorkspaceRow {
                id: row.get(0)?,
                name: row.get(1)?,
                count: row.get(2)?,
                accent_color: row.get(3)?,
                working_folder: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                display_order: row.get(7)?,
                pane_layout: row.get(8)?,
                workspace_mode: row.get(9)?,
                pinned: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r.map_err(|e| e.to_string())?);
    }

    Ok(results)
}

pub fn save_workspace_inner(conn: &Connection, workspace: &WorkspaceRow) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO workspaces (id, name, terminal_count, accent_color, working_folder, created_at, updated_at, display_order, pane_layout, workspace_mode, pinned)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            workspace.id,
            workspace.name,
            workspace.count,
            workspace.accent_color,
            workspace.working_folder,
            workspace.created_at,
            workspace.updated_at,
            workspace.display_order,
            workspace.pane_layout,
            workspace.workspace_mode,
            workspace.pinned,
        ],
    )
    .map_err(|e| format!("Failed to save workspace: {e}"))?;
    let has_pane_table = conn
        .query_row(
            "SELECT EXISTS(
                SELECT 1 FROM sqlite_master
                WHERE type = 'table' AND name = 'workspace_panes'
            )",
            [],
            |row| row.get::<_, bool>(0),
        )
        .map_err(|e| format!("Failed to inspect workspace panes schema: {e}"))?;
    if has_pane_table {
        conn.execute(
            "DELETE FROM workspace_panes WHERE workspace_id = ?1 AND pane_index >= ?2",
            params![workspace.id, workspace.count],
        )
        .map_err(|e| format!("Failed to prune workspace panes: {e}"))?;
    }
    Ok(())
}

pub fn delete_workspace_inner(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM workspaces WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete workspace: {e}"))?;
    // Cascading delete on associated workspace panes
    conn.execute(
        "DELETE FROM workspace_panes WHERE workspace_id = ?1",
        params![id],
    )
    .map_err(|e| format!("Failed to delete workspace panes: {e}"))?;
    Ok(())
}

pub fn reorder_workspaces_inner(
    conn: &mut Connection,
    orders: &[(String, i32)],
) -> Result<(), String> {
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin transaction: {e}"))?;

    for (id, order) in orders {
        tx.execute(
            "UPDATE workspaces SET display_order = ?2 WHERE id = ?1",
            params![id, order],
        )
        .map_err(|e| format!("Failed to update order for {id}: {e}"))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {e}"))?;
    Ok(())
}

// Workspace Panes DB logic helpers
pub fn list_panes_inner(
    conn: &Connection,
    workspace_id: &str,
) -> Result<Vec<WorkspacePaneRow>, String> {
    let mut stmt = conn
        .prepare("SELECT workspace_id, pane_index, working_folder, last_command, auto_launch, agent_provider, native_session_id FROM workspace_panes WHERE workspace_id = ?1 ORDER BY pane_index ASC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![workspace_id], |row| {
            Ok(WorkspacePaneRow {
                workspace_id: row.get(0)?,
                pane_index: row.get(1)?,
                working_folder: row.get(2)?,
                last_command: row.get(3)?,
                auto_launch: row.get(4)?,
                agent_provider: row.get(5)?,
                native_session_id: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r.map_err(|e| e.to_string())?);
    }

    Ok(results)
}

pub fn save_pane_inner(conn: &Connection, pane: &WorkspacePaneRow) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO workspace_panes (workspace_id, pane_index, working_folder, last_command, auto_launch, agent_provider, native_session_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            pane.workspace_id,
            pane.pane_index,
            pane.working_folder,
            pane.last_command,
            pane.auto_launch,
            pane.agent_provider,
            pane.native_session_id
        ],
    )
    .map_err(|e| format!("Failed to save workspace pane: {e}"))?;
    Ok(())
}
