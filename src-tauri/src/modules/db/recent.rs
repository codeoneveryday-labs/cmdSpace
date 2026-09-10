use super::{DbError, DbResult, MobileWorkspaceRow, RecentWorkspaceRow};
use rusqlite::{params, Connection, OptionalExtension};

pub fn list_recent_workspaces_inner(conn: &Connection) -> DbResult<Vec<RecentWorkspaceRow>> {
    let mut stmt = conn
        .prepare("SELECT id, name, terminal_count, working_folder, updated_at FROM recent_workspaces ORDER BY updated_at DESC LIMIT 6")
        .map_err(|e| DbError::sqlite("prepare recent workspace query", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(RecentWorkspaceRow {
                id: row.get(0)?,
                name: row.get(1)?,
                count: row.get(2)?,
                working_folder: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| DbError::sqlite("query recent workspaces", e))?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r.map_err(|e| DbError::sqlite("read recent workspace row", e))?);
    }

    Ok(results)
}

pub fn save_recent_workspace_inner(
    conn: &Connection,
    workspace: &RecentWorkspaceRow,
) -> DbResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO recent_workspaces (id, name, terminal_count, working_folder, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            workspace.id,
            workspace.name,
            workspace.count,
            workspace.working_folder,
            workspace.updated_at,
        ],
    )
    .map_err(|e| DbError::sqlite("save recent workspace", e))?;
    Ok(())
}

pub fn list_mobile_workspaces_inner(
    conn: &Connection,
    owner_device_id: &str,
) -> DbResult<Vec<MobileWorkspaceRow>> {
    let mut stmt = conn
        .prepare(
            "SELECT id, owner_device_id, name, working_folder, created_at, updated_at
             FROM mobile_workspaces WHERE owner_device_id = ?1
             ORDER BY updated_at DESC, created_at ASC",
        )
        .map_err(|e| DbError::sqlite("prepare mobile workspace query", e))?;
    let rows = stmt
        .query_map(params![owner_device_id], |row| {
            Ok(MobileWorkspaceRow {
                id: row.get(0)?,
                owner_device_id: row.get(1)?,
                name: row.get(2)?,
                working_folder: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| DbError::sqlite("query mobile workspaces", e))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| DbError::sqlite("read mobile workspace rows", e))
}

pub fn mobile_workspace_inner(
    conn: &Connection,
    owner_device_id: &str,
    id: &str,
) -> DbResult<Option<MobileWorkspaceRow>> {
    conn.query_row(
        "SELECT id, owner_device_id, name, working_folder, created_at, updated_at
         FROM mobile_workspaces WHERE id = ?1 AND owner_device_id = ?2",
        params![id, owner_device_id],
        |row| {
            Ok(MobileWorkspaceRow {
                id: row.get(0)?,
                owner_device_id: row.get(1)?,
                name: row.get(2)?,
                working_folder: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .optional()
    .map_err(|e| DbError::sqlite("load mobile workspace", e))
}

pub fn mobile_workspace_id_exists_inner(conn: &Connection, id: &str) -> DbResult<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM mobile_workspaces WHERE id = ?1)",
        params![id],
        |row| row.get(0),
    )
    .map_err(|e| DbError::sqlite("check mobile workspace id", e))
}

pub fn save_mobile_workspace_inner(
    conn: &Connection,
    workspace: &MobileWorkspaceRow,
) -> DbResult<()> {
    conn.execute(
        "INSERT INTO mobile_workspaces (id, owner_device_id, name, working_folder, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
            owner_device_id = excluded.owner_device_id,
            name = excluded.name,
            working_folder = excluded.working_folder,
            updated_at = excluded.updated_at",
        params![
            workspace.id,
            workspace.owner_device_id,
            workspace.name,
            workspace.working_folder,
            workspace.created_at,
            workspace.updated_at,
        ],
    )
    .map_err(|e| DbError::sqlite("save mobile workspace", e))?;
    Ok(())
}

pub fn load_workspace_setup_custom_command_inner(conn: &Connection) -> DbResult<String> {
    conn.query_row(
        "SELECT custom_cli_command FROM workspace_setup_preferences WHERE id = 1",
        [],
        |row| row.get(0),
    )
    .optional()
    .map(Option::unwrap_or_default)
    .map_err(|e| DbError::sqlite("load workspace setup custom command", e))
}

pub fn save_workspace_setup_custom_command_inner(conn: &Connection, command: &str) -> DbResult<()> {
    conn.execute(
        "INSERT INTO workspace_setup_preferences (id, custom_cli_command)
         VALUES (1, ?1)
         ON CONFLICT(id) DO UPDATE SET custom_cli_command = excluded.custom_cli_command",
        params![command],
    )
    .map_err(|e| DbError::sqlite("save workspace setup custom command", e))?;
    Ok(())
}
