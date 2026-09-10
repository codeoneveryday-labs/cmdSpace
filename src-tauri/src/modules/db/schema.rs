use super::{DbError, DbResult};
use rusqlite::Connection;

pub(super) fn get_db_path() -> std::path::PathBuf {
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

fn drop_column_if_exists(conn: &Connection, table: &str, column: &str) -> DbResult<()> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|e| DbError::migration("inspect schema columns", e))?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| DbError::migration("read schema columns", e))?;
    for name in columns {
        if name.map_err(|e| DbError::migration("read schema column name", e))? == column {
            conn.execute_batch(&format!("ALTER TABLE {table} DROP COLUMN {column}"))
                .map_err(|e| DbError::migration("drop retired schema column", e))?;
            break;
        }
    }
    Ok(())
}

pub(super) fn migrate_workspace_panes(conn: &Connection) -> DbResult<()> {
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
    .map_err(|e| DbError::migration("create workspace panes table", e))?;

    let columns = {
        let mut stmt = conn
            .prepare("PRAGMA table_info(workspace_panes)")
            .map_err(|e| DbError::migration("inspect workspace panes schema", e))?;
        let columns = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| DbError::migration("read workspace panes schema", e))?;
        let mut found = Vec::new();
        for column in columns {
            found.push(column.map_err(|e| DbError::migration("read schema column name", e))?);
        }
        found
    };
    let auto_launch_added = !columns.iter().any(|column| column == "auto_launch");
    if auto_launch_added {
        conn.execute(
            "ALTER TABLE workspace_panes ADD COLUMN auto_launch INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|e| DbError::migration("add workspace pane auto-launch column", e))?;
    }
    if !columns.iter().any(|column| column == "agent_provider") {
        conn.execute(
            "ALTER TABLE workspace_panes ADD COLUMN agent_provider TEXT",
            [],
        )
        .map_err(|e| DbError::migration("add workspace pane agent column", e))?;
    }
    if !columns.iter().any(|column| column == "native_session_id") {
        conn.execute(
            "ALTER TABLE workspace_panes ADD COLUMN native_session_id TEXT",
            [],
        )
        .map_err(|e| DbError::migration("add workspace pane session column", e))?;
    }
    if auto_launch_added {
        conn.execute(
             "UPDATE workspace_panes SET auto_launch = 1
              WHERE lower(trim(last_command)) IN ('codex', 'claude', 'opencode', 'gemini', 'kimi', 'grok', 'copilot', 'cursor-agent', 'aider', 'pi', 'amp', 'cline', 'goose', 'qwen', 'openhands', 'kiro-cli', 'cmd', 'muse')
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
                OR lower(trim(last_command)) LIKE 'muse %'
                OR lower(trim(last_command)) LIKE 'cmd --%'",
            [],
        )
        .map_err(|e| DbError::migration("migrate pane launch commands", e))?;
    }
    Ok(())
}

pub(super) fn migrate_workspace_setup_preferences(conn: &Connection) -> DbResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS workspace_setup_preferences (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            custom_cli_command TEXT NOT NULL DEFAULT ''
        );",
        [],
    )
    .map_err(|e| DbError::migration("create workspace setup preferences table", e))?;
    Ok(())
}

pub fn init_mobile_workspace_schema(conn: &Connection) -> DbResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS mobile_workspaces (
            id TEXT PRIMARY KEY,
            owner_device_id TEXT NOT NULL,
            name TEXT NOT NULL,
            working_folder TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );",
        [],
    )
    .map_err(|e| DbError::migration("create mobile workspaces table", e))?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS mobile_workspaces_owner_updated
         ON mobile_workspaces(owner_device_id, updated_at DESC);",
        [],
    )
    .map_err(|e| DbError::migration("index mobile workspaces table", e))?;
    Ok(())
}

/// Applies the legacy, unversioned schema shape as migration 1.
///
/// The column checks remain intentionally defensive: databases created before
/// `PRAGMA user_version` was introduced may be at different intermediate
/// shapes. Once this migration completes, all future changes must use a new
/// numbered step in `initialize_schema`.
fn migrate_to_version_1(conn: &Connection) -> DbResult<()> {
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
            workspace_mode TEXT,
            pinned INTEGER NOT NULL DEFAULT 0
        );",
        [],
    )
    .map_err(|e| DbError::migration("create workspaces table", e))?;

    let (has_accent_color, has_pane_layout, has_workspace_mode, has_pinned) = {
        let mut stmt = conn
            .prepare("PRAGMA table_info(workspaces)")
            .map_err(|e| DbError::migration("inspect workspaces schema", e))?;
        let columns = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| DbError::migration("read workspaces schema", e))?;
        let mut found_accent_color = false;
        let mut found_pane_layout = false;
        let mut found_workspace_mode = false;
        let mut found_pinned = false;
        for column in columns {
            match column
                .map_err(|e| DbError::migration("read schema column name", e))?
                .as_str()
            {
                "accent_color" => found_accent_color = true,
                "pane_layout" => found_pane_layout = true,
                "workspace_mode" => found_workspace_mode = true,
                "pinned" => found_pinned = true,
                _ => {}
            }
        }
        (
            found_accent_color,
            found_pane_layout,
            found_workspace_mode,
            found_pinned,
        )
    };
    if !has_accent_color {
        conn.execute("ALTER TABLE workspaces ADD COLUMN accent_color TEXT", [])
            .map_err(|e| DbError::migration("add workspace accent column", e))?;
    }
    if !has_pane_layout {
        conn.execute("ALTER TABLE workspaces ADD COLUMN pane_layout TEXT", [])
            .map_err(|e| DbError::migration("add workspace pane layout column", e))?;
    }
    if !has_workspace_mode {
        conn.execute("ALTER TABLE workspaces ADD COLUMN workspace_mode TEXT", [])
            .map_err(|e| DbError::migration("add workspace mode column", e))?;
    }
    if !has_pinned {
        conn.execute(
            "ALTER TABLE workspaces ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|e| DbError::migration("add workspace pinned column", e))?;
    }

    // Agent chat was removed: drop its workspace columns and tables from
    // databases that predate the removal.
    for column in [
        "agent_provider",
        "agent_session_id",
        "agent_providers",
        "agent_session_ids",
        "agent_chat_ids",
    ] {
        drop_column_if_exists(conn, "workspaces", column)?;
    }
    for table in ["agent_chat_configs", "agent_model_cache"] {
        conn.execute_batch(&format!("DROP TABLE IF EXISTS {table}"))
            .map_err(|e| DbError::migration("drop retired table", e))?;
    }

    migrate_workspace_panes(conn)?;
    migrate_workspace_setup_preferences(conn)?;
    init_mobile_workspace_schema(conn)?;

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
    .map_err(|e| DbError::migration("create recent workspaces table", e))?;

    Ok(())
}

const CURRENT_SCHEMA_VERSION: i64 = 1;

fn schema_version(conn: &Connection) -> DbResult<i64> {
    conn.query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| DbError::migration("read schema version", e))
}

fn set_schema_version(conn: &Connection, version: i64) -> DbResult<()> {
    conn.execute_batch(&format!("PRAGMA user_version = {version}"))
        .map_err(|e| DbError::migration("write schema version", e))
}

/// Runs schema migrations exactly once per version and rejects future schemas.
pub(super) fn initialize_schema(conn: &Connection) -> DbResult<()> {
    let version = schema_version(conn)?;
    match version {
        CURRENT_SCHEMA_VERSION => return Ok(()),
        found if found > CURRENT_SCHEMA_VERSION => {
            return Err(DbError::UnsupportedVersion {
                found,
                supported: CURRENT_SCHEMA_VERSION,
            });
        }
        0 => {}
        _ => {
            return Err(DbError::UnsupportedVersion {
                found: version,
                supported: CURRENT_SCHEMA_VERSION,
            })
        }
    }

    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| DbError::migration("begin schema migration", e))?;
    let migration = if version == 0 {
        migrate_to_version_1(conn)
    } else {
        Err(DbError::UnsupportedVersion {
            found: version,
            supported: CURRENT_SCHEMA_VERSION,
        })
    }
    .and_then(|_| set_schema_version(conn, CURRENT_SCHEMA_VERSION));
    match migration {
        Ok(()) => conn
            .execute_batch("COMMIT")
            .map_err(|e| DbError::migration("commit schema migration", e)),
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub fn init_db() -> DbResult<Connection> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| DbError::sqlite("open database", e))?;
    initialize_schema(&conn)?;
    Ok(conn)
}
