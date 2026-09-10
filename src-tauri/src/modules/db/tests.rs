use super::*;
use std::sync::{Arc, Barrier, Mutex};
use std::thread;
use std::time::Instant;

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
fn database_errors_serialize_as_stable_ipc_envelopes() {
    let mutex_error = serde_json::to_value(DbError::MutexPoisoned).expect("serialize mutex error");
    assert_eq!(
        mutex_error,
        serde_json::json!({
            "code": "DB_MUTEX_POISONED",
            "message": "database state is unavailable",
        })
    );

    let sqlite_error = serde_json::to_value(DbError::sqlite(
        "load workspace",
        rusqlite::Error::InvalidQuery,
    ))
    .expect("serialize sqlite error");
    assert_eq!(sqlite_error["code"], "DB_OPERATION_FAILED");
    assert_eq!(
        sqlite_error["message"],
        "database operation failed: load workspace"
    );
    assert!(!sqlite_error["message"]
        .as_str()
        .expect("serialized message")
        .contains("Query is not read-only"));

    let future_error = serde_json::to_value(DbError::UnsupportedVersion {
        found: 9,
        supported: 1,
    })
    .expect("serialize future schema error");
    assert_eq!(future_error["code"], "DB_SCHEMA_UNSUPPORTED");
    assert_eq!(
        future_error["message"],
        "database schema is newer than supported version 1"
    );
}

#[test]
fn workspace_ipc_dto_round_trips_without_transient_state() {
    let row = WorkspaceRow {
        id: "workspace-1".to_string(),
        name: "Workspace".to_string(),
        count: 2,
        accent_color: Some("#10B981".to_string()),
        working_folder: Some("/tmp/workspace".to_string()),
        created_at: 1,
        updated_at: 2,
        display_order: 0,
        pane_layout: Some("{}".to_string()),
        workspace_mode: Some("standard".to_string()),
        pinned: true,
    };

    let dto = WorkspaceDto::from(row.clone());
    let encoded = serde_json::to_value(&dto).expect("serialize workspace DTO");
    assert_eq!(encoded["accentColor"], "#10B981");
    assert_eq!(encoded["workspaceMode"], "standard");
    assert!(!encoded
        .as_object()
        .expect("workspace object")
        .contains_key("tabId"));
    assert_eq!(WorkspaceRow::from(dto), row);
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

    let version = conn
        .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
        .expect("read schema version");
    assert_eq!(version, 1);

    let workspaces = list_workspaces_inner(&conn).expect("list upgraded workspaces");
    assert_eq!(workspaces.len(), 1);
    assert_eq!(workspaces[0].id, "legacy");
    assert_eq!(workspaces[0].working_folder.as_deref(), Some("/tmp/legacy"));
    assert!(!workspaces[0].pinned);
    assert!(table_columns(&conn, "workspaces").contains(&"pinned".to_string()));
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
fn newer_schema_versions_are_rejected_without_downgrading() {
    let conn = Connection::open_in_memory().expect("open in-memory database");
    conn.execute_batch("PRAGMA user_version = 9;")
        .expect("set future schema version");

    let error = initialize_schema(&conn).expect_err("reject unsupported schema version");
    assert!(matches!(
        error,
        DbError::UnsupportedVersion {
            found: 9,
            supported: 1
        }
    ));

    let version = conn
        .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
        .expect("read schema version");
    assert_eq!(version, 9);
}

#[test]
fn failed_schema_migration_rolls_back_partial_legacy_changes() {
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
        CREATE VIEW workspace_panes AS
            SELECT 1 AS workspace_id, 0 AS pane_index;
        ",
    )
    .expect("create invalid legacy shape");

    let error = initialize_schema(&conn).expect_err("migration should fail for a view");
    assert!(matches!(error, DbError::Migration { .. }));
    assert!(!table_columns(&conn, "workspaces").contains(&"pinned".to_string()));

    let version = conn
        .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
        .expect("read schema version");
    assert_eq!(version, 0);
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
        pinned: true,
    };
    save_workspace_inner(&conn, &w1).expect("save workspace");

    let list = list_workspaces_inner(&conn).expect("list workspaces");
    assert_eq!(list.len(), 1);
    assert_eq!(list[0], w1);
    assert_eq!(list[0].accent_color, Some("#10B981".to_string()));
    assert!(list[0].pinned);

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

    let stale_pane = WorkspacePaneRow {
        workspace_id: "ws-1".to_string(),
        pane_index: 4,
        working_folder: None,
        last_command: Some("claude".to_string()),
        auto_launch: true,
        agent_provider: Some("claude".to_string()),
        native_session_id: None,
    };
    save_pane_inner(&conn, &stale_pane).expect("save stale pane");
    save_workspace_inner(&conn, &w1).expect("resave workspace and prune stale panes");

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

#[derive(Clone, Copy)]
struct DbContentionSample {
    wait_ns: u128,
    operation_ns: u128,
}

fn percentile_ns(samples: &[u128], numerator: usize, denominator: usize) -> u128 {
    assert!(!samples.is_empty(), "percentile requires samples");
    let mut sorted = samples.to_vec();
    sorted.sort_unstable();
    let rank = (sorted.len() - 1) * numerator / denominator;
    sorted[rank]
}

fn db_contention_percentiles(
    samples: &[DbContentionSample],
) -> (u128, u128, u128, u128, u128, u128) {
    let waits: Vec<_> = samples.iter().map(|sample| sample.wait_ns).collect();
    let operations: Vec<_> = samples.iter().map(|sample| sample.operation_ns).collect();
    (
        percentile_ns(&waits, 50, 100),
        percentile_ns(&waits, 95, 100),
        percentile_ns(&waits, 99, 100),
        percentile_ns(&operations, 50, 100),
        percentile_ns(&operations, 95, 100),
        percentile_ns(&operations, 99, 100),
    )
}

#[test]
fn db_mutex_contention_baseline_reports_lock_and_operation_percentiles() {
    const WORKERS: usize = 4;
    const ITERATIONS: usize = 40;
    const SCHEMA_SAMPLES: usize = 8;

    let schema_startup_samples = (0..SCHEMA_SAMPLES)
        .map(|_| {
            let started = Instant::now();
            let conn = Connection::open_in_memory().expect("open schema baseline database");
            initialize_schema(&conn).expect("initialize schema baseline database");
            started.elapsed().as_nanos()
        })
        .collect::<Vec<_>>();

    let conn = Connection::open_in_memory().expect("open contention database");
    initialize_schema(&conn).expect("initialize contention database");
    save_workspace_inner(
        &conn,
        &WorkspaceRow {
            id: "contention-workspace".to_string(),
            name: "Contention baseline".to_string(),
            count: 4,
            accent_color: Some("#10B981".to_string()),
            working_folder: Some("/tmp/contention".to_string()),
            created_at: 1,
            updated_at: 1,
            display_order: 0,
            pane_layout: None,
            workspace_mode: Some("standard".to_string()),
            pinned: false,
        },
    )
    .expect("seed contention workspace");

    let db = Arc::new(Mutex::new(conn));
    let start = Arc::new(Barrier::new(WORKERS));
    let handles = (0..WORKERS)
        .map(|worker_id| {
            let db = Arc::clone(&db);
            let start = Arc::clone(&start);
            thread::spawn(move || {
                start.wait();
                let mut samples = Vec::with_capacity(ITERATIONS);
                for iteration in 0..ITERATIONS {
                    let wait_started = Instant::now();
                    let conn = db.lock().expect("contention database mutex");
                    let wait_ns = wait_started.elapsed().as_nanos();
                    let operation_started = Instant::now();

                    match (worker_id + iteration) % 4 {
                        0 => {
                            list_workspaces_inner(&conn).expect("list workspaces");
                        }
                        1 => {
                            list_panes_inner(&conn, "contention-workspace")
                                .expect("list workspace panes");
                        }
                        2 => {
                            save_recent_workspace_inner(
                                &conn,
                                &RecentWorkspaceRow {
                                    id: format!("recent-{worker_id}-{iteration}"),
                                    name: "Contention recent".to_string(),
                                    count: 1,
                                    working_folder: "/tmp/contention".to_string(),
                                    updated_at: i64::try_from(iteration).expect("iteration fits"),
                                },
                            )
                            .expect("save recent workspace");
                        }
                        _ => {
                            save_pane_inner(
                                &conn,
                                &WorkspacePaneRow {
                                    workspace_id: "contention-workspace".to_string(),
                                    pane_index: i32::try_from((worker_id + iteration) % 4)
                                        .expect("pane index fits"),
                                    working_folder: Some("/tmp/contention".to_string()),
                                    last_command: Some("echo contention".to_string()),
                                    auto_launch: false,
                                    agent_provider: None,
                                    native_session_id: None,
                                },
                            )
                            .expect("save workspace pane");
                        }
                    }

                    samples.push(DbContentionSample {
                        wait_ns,
                        operation_ns: operation_started.elapsed().as_nanos(),
                    });
                }
                samples
            })
        })
        .collect::<Vec<_>>();

    let samples = handles
        .into_iter()
        .flat_map(|handle| handle.join().expect("contention worker"))
        .collect::<Vec<_>>();
    assert_eq!(samples.len(), WORKERS * ITERATIONS);

    let (wait_p50, wait_p95, wait_p99, operation_p50, operation_p95, operation_p99) =
        db_contention_percentiles(&samples);
    let schema_p50 = percentile_ns(&schema_startup_samples, 50, 100);
    let schema_p95 = percentile_ns(&schema_startup_samples, 95, 100);
    let schema_p99 = percentile_ns(&schema_startup_samples, 99, 100);
    eprintln!(
        "[db-contention] workers={WORKERS} iterations={ITERATIONS} samples={} wait_ns(p50/p95/p99)={wait_p50}/{wait_p95}/{wait_p99} operation_ns(p50/p95/p99)={operation_p50}/{operation_p95}/{operation_p99} schema_startup_ns(samples={SCHEMA_SAMPLES},p50/p95/p99)={schema_p50}/{schema_p95}/{schema_p99}",
        samples.len(),
    );
    assert!(wait_p50 <= wait_p95 && wait_p95 <= wait_p99);
    assert!(operation_p50 <= operation_p95 && operation_p95 <= operation_p99);
    assert!(schema_p50 <= schema_p95 && schema_p95 <= schema_p99);
}
