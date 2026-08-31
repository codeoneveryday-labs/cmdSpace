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

pub(super) fn migrate_workspace_panes(conn: &Connection) -> Result<(), String> {
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

    let columns = {
        let mut stmt = conn
            .prepare("PRAGMA table_info(workspace_panes)")
            .map_err(|e| format!("Failed to inspect workspace_panes table: {e}"))?;
        let columns = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| format!("Failed to read workspace_panes table columns: {e}"))?;
        let mut found = Vec::new();
        for column in columns {
            found.push(column.map_err(|e| format!("Failed to read column name: {e}"))?);
        }
        found
    };
    let auto_launch_added = !columns.iter().any(|column| column == "auto_launch");
    if auto_launch_added {
        conn.execute(
            "ALTER TABLE workspace_panes ADD COLUMN auto_launch INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|e| format!("Failed to add auto_launch column: {e}"))?;
    }
    if !columns.iter().any(|column| column == "agent_provider") {
        conn.execute(
            "ALTER TABLE workspace_panes ADD COLUMN agent_provider TEXT",
            [],
        )
        .map_err(|e| format!("Failed to add agent_provider column: {e}"))?;
    }
    if !columns.iter().any(|column| column == "native_session_id") {
        conn.execute(
            "ALTER TABLE workspace_panes ADD COLUMN native_session_id TEXT",
            [],
        )
        .map_err(|e| format!("Failed to add native_session_id column: {e}"))?;
    }
    if auto_launch_added {
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
    }
    Ok(())
}

pub(super) fn migrate_workspace_setup_preferences(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS workspace_setup_preferences (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            custom_cli_command TEXT NOT NULL DEFAULT ''
        );",
        [],
    )
    .map_err(|e| format!("Failed to create workspace_setup_preferences table: {e}"))?;
    Ok(())
}

pub fn init_mobile_workspace_schema(conn: &Connection) -> Result<(), String> {
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
    .map_err(|e| format!("Failed to create mobile_workspaces table: {e}"))?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS mobile_workspaces_owner_updated
         ON mobile_workspaces(owner_device_id, updated_at DESC);",
        [],
    )
    .map_err(|e| format!("Failed to index mobile_workspaces table: {e}"))?;
    Ok(())
}

pub(super) fn initialize_schema(conn: &Connection) -> Result<(), String> {
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
            agent_provider TEXT,
            agent_session_id TEXT
            ,agent_providers TEXT
            ,agent_session_ids TEXT
            ,agent_chat_ids TEXT
        );",
        [],
    )
    .map_err(|e| format!("Failed to create table: {e}"))?;

    let (
        has_accent_color,
        has_pane_layout,
        has_workspace_mode,
        has_agent_provider,
        has_agent_session_id,
        has_agent_providers,
        has_agent_session_ids,
        has_agent_chat_ids,
    ) = {
        let mut stmt = conn
            .prepare("PRAGMA table_info(workspaces)")
            .map_err(|e| format!("Failed to inspect workspaces table: {e}"))?;
        let columns = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| format!("Failed to read workspaces table columns: {e}"))?;
        let mut found_accent_color = false;
        let mut found_pane_layout = false;
        let mut found_workspace_mode = false;
        let mut found_agent_provider = false;
        let mut found_agent_session_id = false;
        let mut found_agent_providers = false;
        let mut found_agent_session_ids = false;
        let mut found_agent_chat_ids = false;
        for column in columns {
            match column
                .map_err(|e| format!("Failed to read column name: {e}"))?
                .as_str()
            {
                "accent_color" => found_accent_color = true,
                "pane_layout" => found_pane_layout = true,
                "workspace_mode" => found_workspace_mode = true,
                "agent_provider" => found_agent_provider = true,
                "agent_session_id" => found_agent_session_id = true,
                "agent_providers" => found_agent_providers = true,
                "agent_session_ids" => found_agent_session_ids = true,
                "agent_chat_ids" => found_agent_chat_ids = true,
                _ => {}
            }
        }
        (
            found_accent_color,
            found_pane_layout,
            found_workspace_mode,
            found_agent_provider,
            found_agent_session_id,
            found_agent_providers,
            found_agent_session_ids,
            found_agent_chat_ids,
        )
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
    if !has_agent_provider {
        conn.execute("ALTER TABLE workspaces ADD COLUMN agent_provider TEXT", [])
            .map_err(|e| format!("Failed to add agent_provider column: {e}"))?;
    }
    if !has_agent_session_id {
        conn.execute(
            "ALTER TABLE workspaces ADD COLUMN agent_session_id TEXT",
            [],
        )
        .map_err(|e| format!("Failed to add agent_session_id column: {e}"))?;
    }
    if !has_agent_providers {
        conn.execute("ALTER TABLE workspaces ADD COLUMN agent_providers TEXT", [])
            .map_err(|e| format!("Failed to add agent_providers column: {e}"))?;
    }
    if !has_agent_session_ids {
        conn.execute(
            "ALTER TABLE workspaces ADD COLUMN agent_session_ids TEXT",
            [],
        )
        .map_err(|e| format!("Failed to add agent_session_ids column: {e}"))?;
    }
    if !has_agent_chat_ids {
        conn.execute("ALTER TABLE workspaces ADD COLUMN agent_chat_ids TEXT", [])
            .map_err(|e| format!("Failed to add agent_chat_ids column: {e}"))?;
    }

    migrate_workspace_panes(conn)?;
    migrate_workspace_setup_preferences(conn)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agent_chat_configs (
            chat_id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            model TEXT,
            effort TEXT,
            permission_mode TEXT,
            fast_mode INTEGER NOT NULL DEFAULT 0,
            plan_mode INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )
    .map_err(|e| format!("Failed to create agent chat config table: {e}"))?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agent_model_cache (
            provider TEXT PRIMARY KEY,
            models_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("Failed to create agent model cache table: {e}"))?;
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
    .map_err(|e| format!("Failed to create recent_workspaces table: {e}"))?;

    Ok(())
}

pub fn init_db() -> Result<Connection, String> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open DB: {e}"))?;
    initialize_schema(&conn)?;
    Ok(conn)
}
