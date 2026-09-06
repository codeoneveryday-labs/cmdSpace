use super::DbState;
use crate::modules::orchestration::{OrchestrationEvent, OrchestrationEventType, OrchestrationRun};
use rusqlite::{params, Connection, OptionalExtension};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn save_orchestration_run_inner(
    conn: &mut Connection,
    run: &OrchestrationRun,
) -> Result<(), String> {
    let snapshot_json = serde_json::to_string(run)
        .map_err(|error| format!("Failed to encode orchestration run: {error}"))?;
    let status = enum_name(&run.status)?;
    let now = now_ms();
    let transaction = conn
        .transaction()
        .map_err(|error| format!("Failed to start orchestration transaction: {error}"))?;
    transaction
        .execute(
            "INSERT INTO orchestration_runs
                (run_id, workspace_id, revision, status, snapshot_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
             ON CONFLICT(run_id) DO UPDATE SET
                workspace_id=excluded.workspace_id,
                revision=excluded.revision,
                status=excluded.status,
                snapshot_json=excluded.snapshot_json,
                updated_at=excluded.updated_at",
            params![
                run.id,
                run.workspace_id,
                run.revision,
                status,
                snapshot_json,
                now
            ],
        )
        .map_err(|error| format!("Failed to save orchestration run: {error}"))?;
    transaction
        .execute(
            "DELETE FROM orchestration_task_executions WHERE run_id = ?1",
            [&run.id],
        )
        .map_err(|error| format!("Failed to replace orchestration tasks: {error}"))?;
    for task in &run.tasks {
        transaction
            .execute(
                "INSERT INTO orchestration_task_executions
                    (run_id, task_id, status, attempt, result_json, chat_id,
                     runtime_session_id, branch_name, worktree_path)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    run.id,
                    task.task_id,
                    enum_name(&task.status)?,
                    task.attempt,
                    task.result,
                    task.chat_id,
                    task.runtime_session_id,
                    task.branch_name,
                    task.worktree_path,
                ],
            )
            .map_err(|error| format!("Failed to save orchestration task: {error}"))?;
    }
    transaction
        .commit()
        .map_err(|error| format!("Failed to commit orchestration run: {error}"))
}

pub fn ensure_canvas_workspace_inner(conn: &Connection, workspace_id: &str) -> Result<(), String> {
    let mode = conn
        .query_row(
            "SELECT workspace_mode FROM workspaces WHERE id = ?1",
            [workspace_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map_err(|error| format!("Failed to inspect workspace mode: {error}"))?
        .flatten();
    if mode.as_deref() == Some("canvas") {
        Ok(())
    } else {
        Err("Orchestration is available only in Canvas workspaces".to_string())
    }
}

pub fn load_orchestration_run_inner(
    conn: &Connection,
    run_id: &str,
) -> Result<Option<OrchestrationRun>, String> {
    let snapshot = conn
        .query_row(
            "SELECT snapshot_json FROM orchestration_runs WHERE run_id = ?1",
            [run_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("Failed to load orchestration run: {error}"))?;
    snapshot
        .map(|value| {
            serde_json::from_str(&value)
                .map_err(|error| format!("Failed to decode orchestration run: {error}"))
        })
        .transpose()
}

pub fn load_active_orchestration_runs_inner(
    conn: &Connection,
) -> Result<Vec<OrchestrationRun>, String> {
    let mut statement = conn
        .prepare(
            "SELECT snapshot_json FROM orchestration_runs
             WHERE status IN ('running', 'paused')
             ORDER BY created_at ASC, run_id ASC",
        )
        .map_err(|error| format!("Failed to prepare active orchestration runs: {error}"))?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| format!("Failed to list active orchestration runs: {error}"))?;
    rows.map(|row| {
        let snapshot = row.map_err(|error| format!("Failed to read orchestration run: {error}"))?;
        serde_json::from_str(&snapshot)
            .map_err(|error| format!("Failed to decode orchestration run: {error}"))
    })
    .collect()
}

pub fn load_orchestration_events_inner(
    conn: &Connection,
    run_id: &str,
) -> Result<Vec<OrchestrationEvent>, String> {
    let mut statement = conn
        .prepare(
            "SELECT sequence, task_id, event_type, payload_json, created_at
             FROM orchestration_events WHERE run_id = ?1 ORDER BY sequence ASC",
        )
        .map_err(|error| format!("Failed to prepare orchestration event replay: {error}"))?;
    let rows = statement
        .query_map([run_id], |row| {
            Ok((
                row.get::<_, u64>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })
        .map_err(|error| format!("Failed to query orchestration event replay: {error}"))?;
    rows.map(|row| {
        let (sequence, task_id, event_type, payload, timestamp) =
            row.map_err(|error| format!("Failed to read orchestration event: {error}"))?;
        Ok(OrchestrationEvent {
            sequence,
            run_id: run_id.to_string(),
            task_id,
            event_type: serde_json::from_str::<OrchestrationEventType>(&format!(
                "\"{event_type}\""
            ))
            .map_err(|error| format!("Failed to decode orchestration event type: {error}"))?,
            timestamp,
            payload: serde_json::from_str(&payload).map_err(|error| {
                format!("Failed to decode orchestration event payload: {error}")
            })?,
        })
    })
    .collect()
}

pub fn append_orchestration_event_inner(
    conn: &Connection,
    event: &OrchestrationEvent,
) -> Result<(), String> {
    let payload = serde_json::to_string(&event.payload)
        .map_err(|error| format!("Failed to encode orchestration event: {error}"))?;
    let event_type = enum_name(&event.event_type)?;
    conn.execute(
        "INSERT OR REPLACE INTO orchestration_events
            (run_id, sequence, task_id, event_type, payload_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            event.run_id,
            event.sequence,
            event.task_id,
            event_type,
            payload,
            event.timestamp,
        ],
    )
    .map_err(|error| format!("Failed to append orchestration event: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn db_load_orchestration_run(
    state: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<Option<OrchestrationRun>, String> {
    let conn = state.0.lock().map_err(|_| "DB mutex poisoned")?;
    load_orchestration_run_inner(&conn, &run_id)
}

fn enum_name<T: serde::Serialize>(value: &T) -> Result<String, String> {
    serde_json::to_value(value)
        .map_err(|error| format!("Failed to encode orchestration state: {error}"))?
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| "Orchestration state must serialize as a string".to_string())
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(i64::MAX))
        .unwrap_or_default()
}
