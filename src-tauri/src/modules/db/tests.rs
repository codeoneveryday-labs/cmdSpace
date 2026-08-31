use super::*;

fn table_columns(conn: &Connection, table: &str) -> Vec<String> {
    let mut statement = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .expect("prepare table inspection");
    statement
        .query_map([], |row| row.get(1))
        .expect("query table columns")
        .map(|column| column.expect("read column name"))
        .collect()
}

#[test]
fn schema_upgrade_preserves_legacy_workspace_rows_and_is_idempotent() {
    let conn = Connection::open_in_memory().expect("open in-memory database");
    conn.execute_batch(
        "CREATE TABLE workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                terminal_count INTEGER NOT NULL,
                working_folder TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                display_order INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO workspaces VALUES ('legacy', 'Legacy', 1, '/tmp/legacy', 1, 2, 0);
            CREATE TABLE workspace_panes (
                workspace_id TEXT NOT NULL,
                pane_index INTEGER NOT NULL,
                working_folder TEXT,
                last_command TEXT,
                PRIMARY KEY (workspace_id, pane_index)
            );
            INSERT INTO workspace_panes VALUES ('legacy', 0, '/tmp/legacy', 'codex --full-auto');",
    )
    .expect("create legacy schema");

    initialize_schema(&conn).expect("upgrade legacy schema");
    initialize_schema(&conn).expect("repeat upgrade");

    let workspaces = list_workspaces_inner(&conn).expect("list upgraded workspaces");
    assert_eq!(workspaces.len(), 1);
    assert_eq!(workspaces[0].id, "legacy");
    assert_eq!(workspaces[0].working_folder.as_deref(), Some("/tmp/legacy"));
    assert!(table_columns(&conn, "workspaces").contains(&"agent_chat_ids".to_string()));
    assert_eq!(
        table_columns(&conn, "workspace_panes"),
        vec![
            "workspace_id",
            "pane_index",
            "working_folder",
            "last_command",
            "auto_launch",
            "agent_provider",
            "native_session_id",
        ]
    );

    let panes = list_panes_inner(&conn, "legacy").expect("list upgraded panes");
    assert_eq!(panes.len(), 1);
    assert!(panes[0].auto_launch);

    for table in [
        "workspace_setup_preferences",
        "agent_chat_configs",
        "agent_model_cache",
        "mobile_workspaces",
        "recent_workspaces",
    ] {
        assert!(
            !table_columns(&conn, table).is_empty(),
            "{table} should exist after schema initialization"
        );
    }
}

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
fn current_schema_reinitialization_should_preserve_explicit_auto_launch_false() {
    let conn = Connection::open_in_memory().expect("open in-memory database");
    conn.execute_batch(
        "CREATE TABLE workspace_panes (
                workspace_id TEXT NOT NULL,
                pane_index INTEGER NOT NULL,
                working_folder TEXT,
                last_command TEXT,
                auto_launch INTEGER NOT NULL DEFAULT 0,
                agent_provider TEXT,
                native_session_id TEXT,
                PRIMARY KEY (workspace_id, pane_index)
            );
            INSERT INTO workspace_panes
                (workspace_id, pane_index, working_folder, last_command, auto_launch)
            VALUES
                ('ws', 0, NULL, 'codex', 0);",
    )
    .expect("create current workspace_panes schema");

    initialize_schema(&conn).expect("initialize schema once");
    initialize_schema(&conn).expect("initialize schema twice");

    let panes = list_panes_inner(&conn, "ws").expect("list workspace panes");
    assert_eq!(panes.len(), 1);
    assert!(!panes[0].auto_launch);
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
        agent_provider: Some("claude".to_string()),
        agent_session_id: Some("claude-session".to_string()),
        agent_chat_ids: None,
        agent_providers: Some(vec!["claude".to_string()]),
        agent_session_ids: Some(vec![Some("claude-session".to_string())]),
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
        agent_provider: None,
        native_session_id: None,
    };
    let p2 = WorkspacePaneRow {
        workspace_id: "ws-1".to_string(),
        pane_index: 1,
        working_folder: None,
        last_command: Some("codex".to_string()),
        auto_launch: true,
        agent_provider: Some("codex".to_string()),
        native_session_id: Some("session-1".to_string()),
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
fn agent_workspace_frontend_payload_deserializes_and_persists() {
    let payload = serde_json::json!({
        "id": "agent-workspace",
        "name": "Agent Workspace",
        "count": 0,
        "accentColor": "#10B981",
        "workingFolder": "/tmp/project",
        "createdAt": 10,
        "updatedAt": 11,
        "displayOrder": 0,
        "paneLayout": null,
        "workspaceMode": "agent",
        "agentProvider": "codex",
        "agentSessionId": null,
        "agentProviders": ["codex", "cmd"],
        "agentSessionIds": [null, null],
        "tabId": 99,
        "canvasTabId": null
    });
    let workspace: WorkspaceRow = serde_json::from_value(payload).unwrap();
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE workspaces (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, terminal_count INTEGER NOT NULL,
                accent_color TEXT, working_folder TEXT, created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL, display_order INTEGER NOT NULL,
                pane_layout TEXT, workspace_mode TEXT, agent_provider TEXT, agent_session_id TEXT,
                agent_providers TEXT, agent_session_ids TEXT, agent_chat_ids TEXT
            );",
    )
    .unwrap();
    save_workspace_inner(&conn, &workspace).unwrap();
    assert_eq!(list_workspaces_inner(&conn).unwrap(), vec![workspace]);
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

#[test]
fn workspace_setup_custom_command_should_survive_sqlite_round_trip() {
    let conn = Connection::open_in_memory().expect("open in-memory database");
    migrate_workspace_setup_preferences(&conn).expect("migrate workspace setup preferences");

    save_workspace_setup_custom_command_inner(&conn, "aider --yes-always")
        .expect("save custom command");

    let command = load_workspace_setup_custom_command_inner(&conn).expect("load custom command");
    assert_eq!(command, "aider --yes-always");
}

#[test]
fn mobile_workspaces_are_scoped_to_the_paired_device_and_do_not_use_desktop_workspaces() {
    let conn = Connection::open_in_memory().expect("open database");
    init_mobile_workspace_schema(&conn).expect("migrate mobile workspace schema");
    save_mobile_workspace_inner(
        &conn,
        &MobileWorkspaceRow {
            id: "ios-one".to_string(),
            owner_device_id: "iphone-a".to_string(),
            name: "Cate".to_string(),
            working_folder: "/Users/test/dev/app/cate".to_string(),
            created_at: 10,
            updated_at: 10,
        },
    )
    .expect("save first mobile workspace");
    save_mobile_workspace_inner(
        &conn,
        &MobileWorkspaceRow {
            id: "ios-two".to_string(),
            owner_device_id: "iphone-b".to_string(),
            name: "Other".to_string(),
            working_folder: "/Users/test/dev/app/other".to_string(),
            created_at: 11,
            updated_at: 11,
        },
    )
    .expect("save second mobile workspace");

    assert_eq!(
        list_mobile_workspaces_inner(&conn, "iphone-a")
            .unwrap()
            .len(),
        1
    );
    assert!(mobile_workspace_inner(&conn, "iphone-a", "ios-two")
        .unwrap()
        .is_none());
}
