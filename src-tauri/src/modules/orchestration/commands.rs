use super::{
    breaker, hive_files, hook_drain, launch, mailbox, memory, now_ms, protocol, router,
    spawn_queue, wake, worktree, OrchestrationEvent, OrchestrationEventType, OrchestrationManifest,
    OrchestrationRun, OrchestrationRuntime,
};
use crate::modules::agent_chat::{events::AgentChatEvent, AgentChatRuntime};
use crate::modules::db::{
    append_orchestration_event_inner, ensure_canvas_workspace_inner,
    load_active_orchestration_runs_inner, load_orchestration_events_inner,
    load_orchestration_run_inner, save_orchestration_run_inner, DbState,
};
use crate::modules::workspace::{authorize_spawn_cwd, WorkspaceEnv, WorkspaceRegistry};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
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
pub fn orchestration_finalize_run(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<worktree::RunFinalizeReport, String> {
    let (run, report) = runtime.finalize_run(run_id.trim())?;
    persist_run(&db, &run)?;
    record_event(
        &runtime,
        &db,
        &run.id,
        None,
        OrchestrationEventType::TaskActivity,
        serde_json::json!({
            "finalize": report
                .entries
                .iter()
                .map(|entry| serde_json::json!({
                    "task": entry.task_id,
                    "integrated": entry.integrated,
                    "preserved": entry.preserved,
                    "reason": entry.reason,
                }))
                .collect::<Vec<_>>(),
        }),
    )?;
    Ok(report)
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
    // Resume only re-queues interrupted tasks; without admitting, the run
    // would sit Running with everything Queued and no worker ever starts.
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
    // Retry only re-queues; admit so the retried task (and anything it
    // unblocks) actually starts instead of stalling in Queued.
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

/// Activity feed for the monitor: newest-first persisted events for a run,
/// mirroring munder's logTail over log.jsonl. Read-only; records no event.
#[tauri::command]
pub fn orchestration_activity_log(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    limit: Option<usize>,
) -> Result<Vec<OrchestrationEvent>, String> {
    runtime.snapshot(run_id.trim())?;
    let conn = db.0.lock().map_err(|_| "DB mutex poisoned")?;
    let mut events = load_orchestration_events_inner(&conn, run_id.trim())?;
    events.sort_by_key(|event| event.sequence);
    let limit = limit.unwrap_or(200).clamp(1, 500);
    if events.len() > limit {
        events.drain(..events.len() - limit);
    }
    events.reverse();
    Ok(events)
}

#[tauri::command]
pub fn orchestration_detach(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    attachment_token: Option<String>,
) -> Result<(), String> {
    runtime.detach(&run_id, attachment_token.as_deref())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn orchestration_mail_send(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    from: String,
    to: String,
    act: mailbox::HiveAct,
    subject: String,
    body: String,
    conversation: Option<String>,
    in_reply_to: Option<String>,
) -> Result<mailbox::HiveMessage, String> {
    let run = runtime.snapshot(&run_id)?;
    let from = from.trim().to_string();
    let to = to.trim().to_string();
    let members = mailbox::roster(&run.manifest);
    let root = mailbox::mailbox_root(&run.id)?;
    // Replies chain server-side: hops derive from the parent (senders never
    // self-report hops), conversation inherits when unstated, and unknown
    // parents fail loudly instead of silently starting a fresh thread.
    let reply_to = in_reply_to
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.trim().to_string());
    let parent = reply_to
        .as_deref()
        .map(|id| {
            mailbox::find_message(&root, &members, id)
                .ok_or_else(|| format!("Unknown parent message '{id}'"))
        })
        .transpose()?;
    let hops = parent.as_ref().map(|message| message.hops + 1).unwrap_or(0);
    mailbox::validate_new_message(&run.manifest, &from, &to, &subject, &body, hops)?;
    let created_at = now_ms();
    let id = mailbox::new_message_id(created_at);
    let message = mailbox::HiveMessage {
        conversation: conversation
            .filter(|value| !value.trim().is_empty())
            .or_else(|| parent.as_ref().map(|message| message.conversation.clone()))
            .unwrap_or_else(|| id.clone()),
        in_reply_to: reply_to,
        id: id.clone(),
        from: from.clone(),
        to: to.clone(),
        act,
        subject: subject.trim().to_string(),
        body: body.trim().to_string(),
        hops,
        requires_reply: mailbox::requires_reply(act),
        needs_human: false,
        created_at,
    };
    mailbox::write_outbox(&root, &from, &message)?;
    // Best-effort auto-route so command-sent mail is delivered immediately
    // (the documented promise). A route failure never fails the send itself:
    // the mail waits in the outbox for the next explicit route.
    let auto = deliver_pending_mail(&run).ok();
    record_event(
        &runtime,
        &db,
        &run.id,
        None,
        OrchestrationEventType::MailSent,
        serde_json::json!({
            "id": id,
            "from": from,
            "to": to,
            "act": act,
            "auto_routed": auto.as_ref().map(|report| report.delivered.len()).unwrap_or(0),
            "auto_skipped": auto.as_ref().map(|report| report.skipped.clone()).unwrap_or_default(),
        }),
    )?;
    Ok(message)
}

/// Cheap unread check for badges and wake facts: ids awaiting handling plus
/// the last ack marker. Read-only; records no event.
#[tauri::command]
pub fn orchestration_mail_unread(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    agent_id: String,
) -> Result<mailbox::MailUnread, String> {
    let run = runtime.snapshot(&run_id)?;
    let agent_id = agent_id.trim();
    if !mailbox::roster(&run.manifest)
        .iter()
        .any(|id| id == agent_id)
    {
        return Err(format!("Unknown mail agent '{agent_id}'"));
    }
    let root = mailbox::mailbox_root(&run.id)?;
    let (unread_ids, last_processed) = mailbox::unread_ids(&root, agent_id);
    Ok(mailbox::MailUnread {
        total: unread_ids.len() as u32,
        unread_ids,
        last_processed,
    })
}

#[tauri::command]
pub fn orchestration_mail_inbox(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    agent_id: String,
) -> Result<Vec<mailbox::HiveMessage>, String> {
    let run = runtime.snapshot(&run_id)?;
    let agent_id = agent_id.trim();
    if !mailbox::roster(&run.manifest)
        .iter()
        .any(|id| id == agent_id)
    {
        return Err(format!("Unknown mail agent '{agent_id}'"));
    }
    let root = mailbox::mailbox_root(&run.id)?;
    // Self-driving delivery: CLI workers write outbox files directly without
    // Tauri access, so every inbox read first drains pending outboxes. The
    // plan is idempotent — re-reads are no-ops — and records no event.
    let _ = deliver_pending_mail(&run);
    Ok(mailbox::read_message_dir(&mailbox::inbox_dir(
        &root, agent_id,
    )))
}

#[tauri::command]
pub fn orchestration_mail_ack(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    agent_id: String,
    message_id: String,
) -> Result<Vec<mailbox::HiveMessage>, String> {
    let run = runtime.snapshot(&run_id)?;
    let agent_id = agent_id.trim();
    let message_id = message_id.trim();
    let root = mailbox::mailbox_root(&run.id)?;
    mailbox::acknowledge(&root, agent_id, message_id)?;
    record_event(
        &runtime,
        &db,
        &run.id,
        None,
        OrchestrationEventType::MailAcknowledged,
        serde_json::json!({ "id": message_id, "by": agent_id }),
    )?;
    Ok(mailbox::read_message_dir(&mailbox::inbox_dir(
        &root, agent_id,
    )))
}

#[tauri::command]
pub fn orchestration_mail_route(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<router::RouteReport, String> {
    let run = runtime.snapshot(&run_id)?;
    let report = deliver_pending_mail(&run)?;
    record_event(
        &runtime,
        &db,
        &run.id,
        None,
        OrchestrationEventType::MailRouted,
        serde_json::json!({
            "delivered": report.delivered.len(),
            "deliveries": report.delivered.clone(),
            "skipped": report.skipped,
        }),
    )?;
    Ok(report)
}

/// Filesystem delivery without side effects: shared by the explicit route
/// command (which records an event) and inbox reads (which stay silent).
fn deliver_pending_mail(run: &OrchestrationRun) -> Result<router::RouteReport, String> {
    let members = mailbox::roster(&run.manifest);
    let root = mailbox::mailbox_root(&run.id)?;
    let mut pending = Vec::new();
    for member in &members {
        for message in mailbox::read_message_dir(&mailbox::outbox_dir(&root, member)) {
            pending.push(message);
        }
    }
    let mut filed = HashSet::new();
    for member in &members {
        for message in mailbox::read_message_dir(&mailbox::inbox_dir(&root, member))
            .into_iter()
            .chain(mailbox::read_message_dir(&mailbox::done_dir(&root, member)))
        {
            filed.insert(message.id);
        }
    }
    let mut report = router::plan_delivery(&pending, &members, &filed);
    let mut failed = Vec::new();
    report.delivered.retain(|delivery| {
        let source = mailbox::outbox_dir(&root, &delivery.from)
            .join(mailbox::message_filename(&delivery.message_id));
        let dest_dir = mailbox::inbox_dir(&root, &delivery.to);
        if fs::create_dir_all(&dest_dir).is_err() {
            failed.push(delivery.message_id.clone());
            return false;
        }
        if fs::rename(
            &source,
            dest_dir.join(mailbox::message_filename(&delivery.message_id)),
        )
        .is_err()
        {
            failed.push(delivery.message_id.clone());
            return false;
        }
        true
    });
    report.skipped.extend(failed);
    Ok(report)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn orchestration_hook_drain(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    agent_id: String,
    kind: hook_drain::HookKind,
    message: Option<String>,
    tool: Option<String>,
    session_id: Option<String>,
) -> Result<hook_drain::DrainDecision, String> {
    let event = hook_drain::HookEvent {
        run_id: run_id.trim().to_string(),
        agent_id: agent_id.trim().to_string(),
        kind,
        message,
        tool: tool.map(|tool| tool.trim().to_string()),
        session_id: session_id.map(|session| session.trim().to_string()),
    };
    let decision = runtime.handle_stop_hook(&event)?;
    record_event(
        &runtime,
        &db,
        &event.run_id,
        None,
        OrchestrationEventType::HookReceived,
        serde_json::json!({
            "agent": event.agent_id,
            "hook": format!("{:?}", event.kind),
            "tool": event.tool,
            "liveness": format!("{:?}", hook_drain::liveness_for(event.kind)).to_lowercase(),
        }),
    )?;
    if let Some(session_id) = event.session_id.as_deref() {
        if !session_id.is_empty() {
            record_event(
                &runtime,
                &db,
                &event.run_id,
                None,
                OrchestrationEventType::SessionRecorded,
                serde_json::json!({ "agent": event.agent_id, "session": session_id }),
            )?;
        }
    }
    if matches!(decision, hook_drain::DrainDecision::RouteThenBlock { .. }) {
        let run = runtime.snapshot(&event.run_id)?;
        let report = deliver_pending_mail(&run)?;
        record_event(
            &runtime,
            &db,
            &run.id,
            None,
            OrchestrationEventType::MailRouted,
            serde_json::json!({
                "agent": event.agent_id,
                "delivered": report.delivered.len(),
            }),
        )?;
        return Ok(hook_drain::DrainDecision::RouteThenBlock {
            delivered: report.delivered.len() as u32,
        });
    }
    Ok(decision)
}

#[tauri::command]
pub fn orchestration_wake_note_spawn(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    pty_id: String,
) -> Result<(), String> {
    runtime.wake_note_spawn(pty_id.trim(), now_ms() as u64)
}

#[tauri::command]
pub fn orchestration_wake_note_hook(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    agent_id: String,
    event: Option<String>,
    message: Option<String>,
) -> Result<(), String> {
    runtime.wake_note_hook(
        agent_id.trim(),
        event.as_deref(),
        message.as_deref(),
        now_ms() as u64,
    )
}

#[tauri::command]
pub fn orchestration_wake_decide(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    workers: Vec<wake::WakeFacts>,
) -> Result<Vec<wake::WakeCandidate>, String> {
    runtime.wake_decide(&run_id, workers, now_ms() as u64)
}

#[tauri::command]
pub fn orchestration_wake_forget(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    agent_id: String,
    pty_id: Option<String>,
) -> Result<(), String> {
    runtime.wake_forget(agent_id.trim(), pty_id.as_deref())
}

#[tauri::command]
pub fn orchestration_breaker_tick(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    input: breaker::BreakerInput,
) -> Result<breaker::BreakerDecision, String> {
    let decision = runtime.breaker_tick(run_id.trim(), input.clone())?;
    if decision.action != breaker::BreakerAction::None {
        let run = runtime.snapshot(run_id.trim())?;
        record_event(
            &runtime,
            &db,
            &run.id,
            None,
            OrchestrationEventType::BreakerTripped,
            serde_json::json!({
                "agent": decision.state.agent_id,
                "action": format!("{:?}", decision.action).to_lowercase(),
                "level": format!("{:?}", decision.state.level).to_lowercase(),
                "reason": decision.state.reason,
            }),
        )?;
    }
    Ok(decision)
}

#[tauri::command]
pub fn orchestration_breaker_level(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    agent_id: String,
) -> Result<breaker::BreakerLevel, String> {
    runtime.breaker_level(run_id.trim(), agent_id.trim())
}

#[tauri::command]
pub fn orchestration_breaker_beat(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    inputs: Vec<breaker::BreakerInput>,
) -> Result<Vec<breaker::BreakerDecision>, String> {
    let decisions = runtime.breaker_beat(run_id.trim(), inputs)?;
    let run = runtime.snapshot(run_id.trim())?;
    for decision in &decisions {
        if decision.action == breaker::BreakerAction::None {
            continue;
        }
        record_event(
            &runtime,
            &db,
            &run.id,
            None,
            OrchestrationEventType::BreakerTripped,
            serde_json::json!({
                "agent": decision.state.agent_id,
                "action": format!("{:?}", decision.action).to_lowercase(),
                "level": format!("{:?}", decision.state.level).to_lowercase(),
                "reason": decision.state.reason,
            }),
        )?;
    }
    Ok(decisions)
}

/// Resolve a worker launch line into an executable + argv triple without
/// spawning anything. Provider-agnostic: the caller supplies the
/// catalog-resolved command, auto flag, and model. Worker start (their call
/// site) stays the only spawner.
#[tauri::command]
pub fn orchestration_resolve_launch(
    request_command: Option<String>,
    default_command: String,
    auto_flag: Option<String>,
    model: Option<String>,
) -> Result<launch::WorkerLaunch, String> {
    launch::build_worker_launch(launch::WorkerLaunchRequest {
        request_command: request_command.as_deref(),
        default_command: &default_command,
        auto_flag: auto_flag.as_deref(),
        model: model.as_deref(),
    })
}

/// Ensure one agent's identity exists on disk and return its text. Workers
/// read it at task start to become hive-aware; overwritten every call so it
/// tracks live task state. (Shared PROTOCOL.md is owned by the hive bundle.)
#[tauri::command]
pub fn orchestration_agent_identity(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    agent_id: String,
) -> Result<protocol::AgentIdentity, String> {
    let run = runtime.snapshot(&run_id)?;
    protocol::ensure_identity(&run.id, agent_id.trim(), &run)
}

/// Mine one run's agent memories (`memory.md` per agent plus the shared
/// `board.md`) into the full-text index. Skips unchanged files by content
/// hash; returns what was (re)indexed.
#[tauri::command]
pub fn orchestration_memory_reindex(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
) -> Result<memory::MemoryIndexReport, String> {
    let run = runtime.snapshot(&run_id)?;
    let conn = db.0.lock().map_err(|_| "DB mutex poisoned")?;
    memory::index_run_memories(&conn, &run.id)
}

/// Full-text recall over one run's indexed memories (FTS5 MATCH syntax).
/// Scoped to the run; never leaks across runs.
#[tauri::command]
pub fn orchestration_memory_search(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<memory::MemoryHit>, String> {
    runtime.snapshot(&run_id)?;
    let conn = db.0.lock().map_err(|_| "DB mutex poisoned")?;
    memory::search_memories(&conn, &run_id, &query, limit)
}

/// Append an attributed note to the board's agent-owned freeform section.
/// The auto-rendered task block is regenerated around it, never lost.
#[tauri::command]
pub fn orchestration_board_note(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    db: tauri::State<'_, DbState>,
    run_id: String,
    agent_id: String,
    text: String,
) -> Result<String, String> {
    let run = runtime.snapshot(&run_id)?;
    let agent_id = agent_id.trim();
    if !mailbox::roster(&run.manifest)
        .iter()
        .any(|id| id == agent_id)
    {
        return Err(format!("Unknown mail agent '{agent_id}'"));
    }
    let board = hive_files::append_board_note(&run, agent_id, &text)?;
    record_event(
        &runtime,
        &db,
        &run.id,
        None,
        OrchestrationEventType::TaskActivity,
        serde_json::json!({ "board": "note", "by": agent_id }),
    )?;
    Ok(board)
}

/// Pending ephemeral spawn requests for a run (Boss-written JSON files).
#[tauri::command]
pub fn orchestration_spawn_list(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
) -> Result<Vec<spawn_queue::PendingSpawnRequest>, String> {
    runtime.snapshot(&run_id)?;
    spawn_queue::list_pending(&run_id)
}

/// Claim a spawn request, archiving it to `spawn-requests/.done/`.
#[tauri::command]
pub fn orchestration_spawn_claim(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    id: String,
) -> Result<spawn_queue::PendingSpawnRequest, String> {
    runtime.snapshot(&run_id)?;
    spawn_queue::claim(&run_id, &id)
}

fn persist_run(db: &DbState, run: &OrchestrationRun) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|_| "DB mutex poisoned")?;
    save_orchestration_run_inner(&mut conn, run)?;
    // The hive bundle is a read view for CLI workers; sync is best-effort and
    // never fails the transition.
    hive_files::sync_run_files(run);
    Ok(())
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
