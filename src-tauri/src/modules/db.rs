use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

pub struct DbState(pub Mutex<Connection>);

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct WorkspaceRow {
    pub id: String,
    pub name: String,
    pub count: i32,
    #[serde(rename = "accentColor")]
    pub accent_color: Option<String>,
    #[serde(rename = "workingFolder")]
    pub working_folder: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "displayOrder")]
    pub display_order: i32,
    #[serde(rename = "paneLayout")]
    pub pane_layout: Option<String>,
    #[serde(rename = "workspaceMode")]
    pub workspace_mode: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct WorkspacePaneRow {
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    #[serde(rename = "paneIndex")]
    pub pane_index: i32,
    #[serde(rename = "workingFolder")]
    pub working_folder: Option<String>,
    #[serde(rename = "lastCommand")]
    pub last_command: Option<String>,
    #[serde(rename = "autoLaunch", default)]
    pub auto_launch: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RecentWorkspaceRow {
    pub id: String,
    pub name: String,
    pub count: i32,
    #[serde(rename = "workingFolder")]
    pub working_folder: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

fn get_db_path() -> std::path::PathBuf {
    #[cfg(test)]
    {
        // Standalone temp path for isolated unit tests
        let thread_id = format!("{:?}", std::thread::current().id())
            .chars()
            .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '_' })
            .collect::<String>();
        std::env::temp_dir().join(format!(
            "cmdspace_test_{}_{}.db",
            std::process::id(),
            thread_id,
        ))
    }
    #[cfg(not(test))]
    {
        let mut path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
        path.push("app.tranhoangpich.cmdspace");
        let _ = std::fs::create_dir_all(&path);
        path.push("cmdspace.db");
        path
    }
}

fn migrate_workspace_panes(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS workspace_panes (
            workspace_id TEXT NOT NULL,
            pane_index INTEGER NOT NULL,
            working_folder TEXT,
            last_command TEXT,
            auto_launch INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (workspace_id, pane_index)
        );",
        [],
    )
    .map_err(|e| format!("Failed to create workspace_panes table: {e}"))?;

    let has_auto_launch = {
        let mut stmt = conn
            .prepare("PRAGMA table_info(workspace_panes)")
            .map_err(|e| format!("Failed to inspect workspace_panes table: {e}"))?;
        let columns = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| format!("Failed to read workspace_panes table columns: {e}"))?;
        let mut found = false;
        for column in columns {
            if column.map_err(|e| format!("Failed to read column name: {e}"))? == "auto_launch" {
                found = true;
                break;
            }
        }
        found
    };
    if has_auto_launch {
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE workspace_panes ADD COLUMN auto_launch INTEGER NOT NULL DEFAULT 0",
        [],
    )
    .map_err(|e| format!("Failed to add auto_launch column: {e}"))?;
    conn.execute(
        "UPDATE workspace_panes SET auto_launch = 1
         WHERE lower(trim(last_command)) IN ('codex', 'claude', 'opencode', 'gemini', 'kimi', 'grok', 'copilot', 'cursor-agent', 'aider', 'pi', 'amp', 'cline', 'goose', 'qwen', 'openhands', 'kiro-cli', 'cmd')
            OR lower(trim(last_command)) LIKE 'codex %'
            OR lower(trim(last_command)) LIKE 'claude %'
            OR lower(trim(last_command)) LIKE 'opencode %'
            OR lower(trim(last_command)) LIKE 'gemini %'
            OR lower(trim(last_command)) LIKE 'kimi %'
            OR lower(trim(last_command)) LIKE 'grok %'
            OR lower(trim(last_command)) LIKE 'copilot %'
            OR lower(trim(last_command)) LIKE 'cursor-agent %'
            OR lower(trim(last_command)) LIKE 'aider %'
            OR lower(trim(last_command)) LIKE 'pi %'
            OR lower(trim(last_command)) LIKE 'amp %'
            OR lower(trim(last_command)) LIKE 'cline %'
            OR lower(trim(last_command)) LIKE 'goose %'
            OR lower(trim(last_command)) LIKE 'qwen %'
            OR lower(trim(last_command)) LIKE 'openhands %'
            OR lower(trim(last_command)) LIKE 'kiro-cli %'
            OR lower(trim(last_command)) LIKE 'cmd --%'",
        [],
    )
    .map_err(|e| format!("Failed to migrate pane launch commands: {e}"))?;
    Ok(())
}

pub fn init_db() -> Result<Connection, String> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open DB: {e}"))?;

    // Migrate workspaces table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            terminal_count INTEGER NOT NULL,
            accent_color TEXT,
            working_folder TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            display_order INTEGER NOT NULL DEFAULT 0,
            pane_layout TEXT,
            workspace_mode TEXT
        );",
        [],
    )
    .map_err(|e| format!("Failed to create table: {e}"))?;

    let (has_accent_color, has_pane_layout, has_workspace_mode) = {
        let mut stmt = conn
            .prepare("PRAGMA table_info(workspaces)")
            .map_err(|e| format!("Failed to inspect workspaces table: {e}"))?;
        let columns = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| format!("Failed to read workspaces table columns: {e}"))?;
        let mut found_accent_color = false;
        let mut found_pane_layout = false;
        let mut found_workspace_mode = false;
        for column in columns {
            match column
                .map_err(|e| format!("Failed to read column name: {e}"))?
                .as_str()
            {
                "accent_color" => found_accent_color = true,
                "pane_layout" => found_pane_layout = true,
                "workspace_mode" => found_workspace_mode = true,
                _ => {}
            }
        }
        (found_accent_color, found_pane_layout, found_workspace_mode)
    };
    if !has_accent_color {
        conn.execute("ALTER TABLE workspaces ADD COLUMN accent_color TEXT", [])
            .map_err(|e| format!("Failed to add accent_color column: {e}"))?;
    }
    if !has_pane_layout {
        conn.execute("ALTER TABLE workspaces ADD COLUMN pane_layout TEXT", [])
            .map_err(|e| format!("Failed to add pane_layout column: {e}"))?;
    }
    if !has_workspace_mode {
        conn.execute("ALTER TABLE workspaces ADD COLUMN workspace_mode TEXT", [])
            .map_err(|e| format!("Failed to add workspace_mode column: {e}"))?;
    }

    migrate_workspace_panes(&conn)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS recent_workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            terminal_count INTEGER NOT NULL,
            working_folder TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );",
        [],
    )
    .map_err(|e| format!("Failed to create recent_workspaces table: {e}"))?;

    Ok(conn)
}

// Inner logic functions, decoupled from tauri::State for direct, easy unit testing
pub fn list_workspaces_inner(conn: &Connection) -> Result<Vec<WorkspaceRow>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, terminal_count, accent_color, working_folder, created_at, updated_at, display_order, pane_layout, workspace_mode FROM workspaces ORDER BY display_order ASC, created_at ASC")
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
        "INSERT OR REPLACE INTO workspaces (id, name, terminal_count, accent_color, working_folder, created_at, updated_at, display_order, pane_layout, workspace_mode)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
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
            workspace.workspace_mode
        ],
    )
    .map_err(|e| format!("Failed to save workspace: {e}"))?;
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
        .prepare("SELECT workspace_id, pane_index, working_folder, last_command, auto_launch FROM workspace_panes WHERE workspace_id = ?1 ORDER BY pane_index ASC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![workspace_id], |row| {
            Ok(WorkspacePaneRow {
                workspace_id: row.get(0)?,
                pane_index: row.get(1)?,
                working_folder: row.get(2)?,
                last_command: row.get(3)?,
                auto_launch: row.get(4)?,
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
        "INSERT OR REPLACE INTO workspace_panes (workspace_id, pane_index, working_folder, last_command, auto_launch)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            pane.workspace_id,
            pane.pane_index,
            pane.working_folder,
            pane.last_command,
            pane.auto_launch
        ],
    )
    .map_err(|e| format!("Failed to save workspace pane: {e}"))?;
    Ok(())
}

pub fn list_recent_workspaces_inner(conn: &Connection) -> Result<Vec<RecentWorkspaceRow>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, terminal_count, working_folder, updated_at FROM recent_workspaces ORDER BY updated_at DESC LIMIT 6")
        .map_err(|e| e.to_string())?;

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
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r.map_err(|e| e.to_string())?);
    }

    Ok(results)
}

pub fn save_recent_workspace_inner(
    conn: &Connection,
    workspace: &RecentWorkspaceRow,
) -> Result<(), String> {
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
    .map_err(|e| format!("Failed to save recent workspace: {e}"))?;
    Ok(())
}

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pane_migration_should_not_replay_ordinary_shell_history() {
        let conn = Connection::open_in_memory().expect("open in-memory database");
        conn.execute_batch(
            "CREATE TABLE workspace_panes (
                workspace_id TEXT NOT NULL,
                pane_index INTEGER NOT NULL,
                working_folder TEXT,
                last_command TEXT,
                PRIMARY KEY (workspace_id, pane_index)
            );
            INSERT INTO workspace_panes VALUES ('ws', 0, NULL, 'hello');
            INSERT INTO workspace_panes VALUES ('ws', 1, NULL, 'codex --full-auto');",
        )
        .expect("create legacy workspace panes");

        migrate_workspace_panes(&conn).expect("migrate workspace panes");

        let panes = list_panes_inner(&conn, "ws").expect("list migrated panes");
        assert!(!panes[0].auto_launch);
        assert!(panes[1].auto_launch);
    }

    #[test]
    fn test_sqlite_crud_operations() {
        // Clean up any test database from previous runs
        let test_path = get_db_path();
        let _ = std::fs::remove_file(&test_path);

        let conn = init_db().expect("init database");

        // 1. Initially empty
        let initial = list_workspaces_inner(&conn).expect("list workspaces");
        assert_eq!(initial.len(), 0);

        // 2. Insert workspace
        let w1 = WorkspaceRow {
            id: "ws-1".to_string(),
            name: "Default Workspace".to_string(),
            count: 4,
            accent_color: Some("#10B981".to_string()),
            working_folder: Some("/path/to/project".to_string()),
            created_at: 1000,
            updated_at: 2000,
            display_order: 0,
            pane_layout: Some("{\"kind\":\"leaf\",\"size\":100}".to_string()),
            workspace_mode: Some("canvas".to_string()),
        };
        save_workspace_inner(&conn, &w1).expect("save workspace");

        let list = list_workspaces_inner(&conn).expect("list workspaces");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0], w1);
        assert_eq!(list[0].accent_color, Some("#10B981".to_string()));

        // 3. Save panes for the workspace
        let p1 = WorkspacePaneRow {
            workspace_id: "ws-1".to_string(),
            pane_index: 0,
            working_folder: Some("/path/to/project/src".to_string()),
            last_command: Some("npm run dev".to_string()),
            auto_launch: false,
        };
        let p2 = WorkspacePaneRow {
            workspace_id: "ws-1".to_string(),
            pane_index: 1,
            working_folder: None,
            last_command: Some("codex".to_string()),
            auto_launch: true,
        };
        save_pane_inner(&conn, &p1).expect("save pane 1");
        save_pane_inner(&conn, &p2).expect("save pane 2");

        let panes = list_panes_inner(&conn, "ws-1").expect("list workspace panes");
        assert_eq!(panes.len(), 2);
        assert_eq!(panes[0], p1);
        assert_eq!(panes[1], p2);

        // 4. Update pane
        let mut p1_updated = p1.clone();
        p1_updated.last_command = Some("node index.js".to_string());
        save_pane_inner(&conn, &p1_updated).expect("update pane 1");

        let panes = list_panes_inner(&conn, "ws-1").expect("list workspace panes");
        assert_eq!(panes[0].last_command, Some("node index.js".to_string()));

        // 5. Delete workspace (should trigger cascading delete of panes)
        delete_workspace_inner(&conn, "ws-1").expect("delete workspace");
        let list = list_workspaces_inner(&conn).expect("list workspaces after delete");
        assert_eq!(list.len(), 0);

        let panes =
            list_panes_inner(&conn, "ws-1").expect("list workspace panes after workspace delete");
        assert_eq!(panes.len(), 0); // Cascading deleted successfully!

        let _ = std::fs::remove_file(&test_path);
    }

    #[test]
    fn recent_workspaces_survive_workspace_delete_and_limit_to_six() {
        let test_path = get_db_path();
        let _ = std::fs::remove_file(&test_path);

        let conn = init_db().expect("init database");
        for index in 1..=7 {
            let workspace = RecentWorkspaceRow {
                id: format!("ws-{index}"),
                name: format!("workspace-{index:02}"),
                count: index,
                working_folder: format!("/tmp/workspace-{index:02}"),
                updated_at: i64::from(index),
            };
            save_recent_workspace_inner(&conn, &workspace).expect("save recent workspace");
        }

        delete_workspace_inner(&conn, "ws-7").expect("delete active workspace row");

        let recent = list_recent_workspaces_inner(&conn).expect("list recent workspaces");
        assert_eq!(recent.len(), 6);
        assert_eq!(recent[0].id, "ws-7");
        assert_eq!(recent[5].id, "ws-2");

        let _ = std::fs::remove_file(&test_path);
    }
}
