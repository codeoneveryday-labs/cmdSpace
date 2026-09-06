use super::{
    OrchestrationEvent, OrchestrationEventType, OrchestrationManifest, OrchestrationRun,
    OrchestrationRuntime,
};
use crate::modules::agent_chat::{events::AgentChatEvent, AgentChatRuntime};
use crate::modules::db::{
    append_orchestration_event_inner, ensure_canvas_workspace_inner,
    load_active_orchestration_runs_inner, load_orchestration_events_inner,
    load_orchestration_run_inner, save_orchestration_run_inner, DbState,
};
use crate::modules::workspace::{authorize_spawn_cwd, WorkspaceEnv, WorkspaceRegistry};
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tauri::ipc::Channel;

#[tauri::command]
pub fn orchestration_create_run(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    workspace_id: String,
    cwd: String,
    run_id: String,
    manifest: OrchestrationManifest,
) -> Result<OrchestrationRun, String> {
    {
        let conn = db.0.lock().map_err(|_| "DB mutex poisoned")?;
        ensure_canvas_workspace_inner(&conn, &workspace_id)?;
    }
    let run = runtime.create_run(run_id, workspace_id, cwd, manifest)?;
    persist_run(&db, &run)?;
    record_event(
        &runtime,
        &db,
        &run.id,
        None,
        OrchestrationEventType::RunCreated,
        Value::Null,
    )?;
    Ok(run)
}

#[tauri::command]
pub fn orchestration_update_draft(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    expected_revision: u64,
    manifest: OrchestrationManifest,
) -> Result<OrchestrationRun, String> {
    let run = runtime.update_draft(&run_id, expected_revision, manifest)?;
    persist_run(&db, &run)?;
    record_event(
        &runtime,
        &db,
        &run_id,
        None,
        OrchestrationEventType::DraftUpdated,
        Value::Null,
    )?;
    Ok(run)
}

#[tauri::command]
pub fn orchestration_request_revision(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    feedback: String,
) -> Result<OrchestrationRun, String> {
    let run = runtime.snapshot(&run_id)?;
    record_event(
        &runtime,
        &db,
        &run_id,
        None,
        OrchestrationEventType::RevisionRequested,
        serde_json::json!({ "feedback": feedback.trim() }),
    )?;
    Ok(run)
}

#[tauri::command]
pub fn orchestration_approve_and_start(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    expected_revision: u64,
) -> Result<OrchestrationRun, String> {
    let run = runtime.approve_and_start(&run_id, expected_revision)?;
    persist_run(&db, &run)?;
    record_event(
        &runtime,
        &db,
        &run_id,
        None,
        OrchestrationEventType::Approved,
        Value::Null,
    )?;
    let (run, started) = runtime.admit_ready_tasks(&run_id, 3)?;
    persist_run(&db, &run)?;
    for task_id in started {
        record_event(
            &runtime,
            &db,
            &run_id,
            Some(task_id),
            OrchestrationEventType::TaskStarted,
            Value::Null,
        )?;
    }
    Ok(run)
}

#[tauri::command]
pub fn orchestration_prepare_task_worktree(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    registry: tauri::State<'_, WorkspaceRegistry>,
    run_id: String,
    task_id: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<OrchestrationRun, String> {
    let workspace = WorkspaceEnv::from_option(workspace);
    let run = runtime.snapshot(&run_id)?;
    authorize_spawn_cwd(&registry, Some(&run.cwd), &workspace)?
        .ok_or_else(|| "Orchestration requires a working folder".to_string())?;
    let run = runtime.prepare_task_worktree(&run_id, &task_id, &workspace)?;
    persist_run(&db, &run)?;
    Ok(run)
}

#[tauri::command]
pub async fn orchestration_complete_task(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    task_id: String,
    result: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<OrchestrationRun, String> {
    let before = runtime.snapshot(&run_id)?;
    let task_spec = before
        .manifest
        .tasks
        .iter()
        .find(|task| task.id == task_id)
        .cloned()
        .ok_or_else(|| format!("Unknown orchestration task '{task_id}'"))?;
    let validation_cwd = before
        .tasks
        .iter()
        .find(|task| task.task_id == task_id)
        .and_then(|task| task.worktree_path.clone())
        .unwrap_or_else(|| before.cwd.clone());
    let workspace = WorkspaceEnv::from_option(workspace);
    let run = runtime.begin_validation(&run_id, &task_id)?;
    persist_run(&db, &run)?;
    let commands = task_spec.validation_commands;
    let validation_result = tauri::async_runtime::spawn_blocking(move || {
        for command in commands {
            let output = crate::modules::shell::run_blocking_inner(
                command,
                Some(validation_cwd.clone()),
                workspace.clone(),
                Duration::from_secs(300),
            )?;
            if output.exit_code != Some(0) || output.timed_out {
                return Err(format!(
                    "Validation failed (exit {:?}): {}",
                    output.exit_code,
                    output.stderr.trim()
                ));
            }
        }
        Ok::<(), String>(())
    })
    .await
    .map_err(|error| format!("Validation worker failed: {error}"))?;
    let validation_passed = validation_result.is_ok();
    let run = match validation_result {
        Ok(()) => {
            if let Err(error) = runtime.integrate_task(&run_id, &task_id) {
                let blocked = runtime.block_task(&run_id, &task_id, &error)?;
                persist_run(&db, &blocked)?;
                record_event(
                    &runtime,
                    &db,
                    &run_id,
                    Some(task_id.clone()),
                    OrchestrationEventType::TaskBlocked,
                    serde_json::json!({ "error": error }),
                )?;
                return Ok(blocked);
            }
            runtime.complete_task(&run_id, &task_id, &result)?
        }
        Err(error) => runtime.fail_task(&run_id, &task_id, &error)?,
    };
    persist_run(&db, &run)?;
    record_event(
        &runtime,
        &db,
        &run_id,
        Some(task_id),
        if validation_passed {
            OrchestrationEventType::TaskCompleted
        } else {
            OrchestrationEventType::TaskFailed
        },
        serde_json::json!({ "result": result }),
    )?;
    if validation_passed {
        let (run, started) = runtime.admit_ready_tasks(&run_id, 3)?;
        persist_run(&db, &run)?;
        for task_id in started {
            record_event(
                &runtime,
                &db,
                &run_id,
                Some(task_id),
                OrchestrationEventType::TaskStarted,
                Value::Null,
            )?;
        }
        return Ok(run);
    }
    Ok(run)
}

#[tauri::command]
pub fn orchestration_fail_task(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    task_id: String,
    error: String,
) -> Result<OrchestrationRun, String> {
    let run = runtime.fail_task(&run_id, &task_id, error.trim())?;
    persist_run(&db, &run)?;
    record_event(
        &runtime,
        &db,
        &run_id,
        Some(task_id),
        OrchestrationEventType::TaskFailed,
        serde_json::json!({ "error": error }),
    )?;
    Ok(run)
}

#[tauri::command]
pub fn orchestration_bind_task_session(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    agent_chat: tauri::State<'_, AgentChatRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    task_id: String,
    chat_id: String,
    runtime_session_id: String,
) -> Result<OrchestrationRun, String> {
    let run = runtime.bind_task_session(&run_id, &task_id, &chat_id, &runtime_session_id)?;
    persist_run(&db, &run)?;
    let observed_runtime = runtime.inner().clone();
    let observed_run_id = run_id.clone();
    let observed_task_id = task_id.clone();
    agent_chat.observe_session(
        &runtime_session_id,
        Arc::new(move |event: AgentChatEvent| {
            let payload = serde_json::to_value(event).unwrap_or(Value::Null);
            let _ = observed_runtime.record_event(
                &observed_run_id,
                Some(observed_task_id.clone()),
                OrchestrationEventType::TaskActivity,
                payload,
            );
        }),
    )?;
    Ok(run)
}

#[tauri::command]
pub fn orchestration_mark_interrupted(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let persisted = {
        let conn = db.0.lock().map_err(|_| "DB mutex poisoned")?;
        load_active_orchestration_runs_inner(&conn)?
    };
    for run in persisted {
        let events = {
            let conn = db.0.lock().map_err(|_| "DB mutex poisoned")?;
            load_orchestration_events_inner(&conn, &run.id)?
        };
        runtime.restore_run_with_events(run, events)?;
    }
    for run in runtime.interrupt_active_runs()? {
        persist_run(&db, &run)?;
        record_event(
            &runtime,
            &db,
            &run.id,
            None,
            OrchestrationEventType::Interrupted,
            Value::Null,
        )?;
    }
    Ok(())
}

#[tauri::command]
pub fn orchestration_pause(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<OrchestrationRun, String> {
    let run = runtime.pause(&run_id)?;
    persist_run(&db, &run)?;
    record_event(
        &runtime,
        &db,
        &run_id,
        None,
        OrchestrationEventType::RunPaused,
        Value::Null,
    )?;
    Ok(run)
}

#[tauri::command]
pub fn orchestration_resume(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<OrchestrationRun, String> {
    let run = runtime.resume(&run_id)?;
    persist_run(&db, &run)?;
    record_event(
        &runtime,
        &db,
        &run_id,
        None,
        OrchestrationEventType::RunResumed,
        Value::Null,
    )?;
    Ok(run)
}

#[tauri::command]
pub fn orchestration_cancel(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<OrchestrationRun, String> {
    let run = runtime.cancel(&run_id)?;
    persist_run(&db, &run)?;
    record_event(
        &runtime,
        &db,
        &run_id,
        None,
        OrchestrationEventType::RunCancelled,
        Value::Null,
    )?;
    Ok(run)
}

#[tauri::command]
pub fn orchestration_retry_task(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    task_id: String,
) -> Result<OrchestrationRun, String> {
    let run = runtime.retry_task(&run_id, &task_id)?;
    persist_run(&db, &run)?;
    record_event(
        &runtime,
        &db,
        &run_id,
        Some(task_id),
        OrchestrationEventType::TaskStarted,
        Value::Null,
    )?;
    Ok(run)
}

#[tauri::command]
pub fn orchestration_snapshot(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<OrchestrationRun, String> {
    match runtime.snapshot(&run_id) {
        Ok(run) => Ok(run),
        Err(_) => {
            let conn = db.0.lock().map_err(|_| "DB mutex poisoned")?;
            let run = load_orchestration_run_inner(&conn, &run_id)?
                .ok_or_else(|| format!("Unknown orchestration run '{run_id}'"))?;
            let events = load_orchestration_events_inner(&conn, &run_id)?;
            drop(conn);
            runtime.restore_run_with_events(run, events)
        }
    }
}

#[tauri::command]
pub fn orchestration_attach(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    on_event: Channel<OrchestrationEvent>,
) -> Result<String, String> {
    runtime.attach(&run_id, on_event)
}

#[tauri::command]
pub fn orchestration_detach(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    attachment_token: Option<String>,
) -> Result<(), String> {
    runtime.detach(&run_id, attachment_token.as_deref())
}

fn persist_run(db: &DbState, run: &OrchestrationRun) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|_| "DB mutex poisoned")?;
    save_orchestration_run_inner(&mut conn, run)
}

fn record_event(
    runtime: &OrchestrationRuntime,
    db: &DbState,
    run_id: &str,
    task_id: Option<String>,
    event_type: OrchestrationEventType,
    payload: Value,
) -> Result<OrchestrationEvent, String> {
    let event = runtime.record_event(run_id, task_id, event_type, payload)?;
    let conn = db.0.lock().map_err(|_| "DB mutex poisoned")?;
    append_orchestration_event_inner(&conn, &event)?;
    Ok(event)
}
