use super::super::command_support::{deliver_pending_mail, persist_run, record_event};
use super::super::{
    breaker, hive_files, hook_drain, launch, mailbox, memory, now_ms, protocol, router,
    spawn_queue, wake, OrchestrationEvent, OrchestrationEventType, OrchestrationManifest,
    OrchestrationRun, OrchestrationRuntime,
};
use crate::modules::agent_chat::{events::AgentChatEvent, AgentChatRuntime};
use crate::modules::db::{
    ensure_canvas_workspace_inner, load_active_orchestration_runs_inner,
    load_orchestration_events_inner, load_orchestration_run_inner, DbState,
};
use crate::modules::workspace::{authorize_spawn_cwd, WorkspaceEnv, WorkspaceRegistry};
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tauri::ipc::Channel;

pub(crate) fn create_run_impl(
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

pub(crate) fn update_draft_impl(
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

pub(crate) fn request_revision_impl(
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

pub(crate) fn approve_and_start_impl(
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

pub(crate) fn prepare_task_worktree_impl(
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

pub(crate) async fn complete_task_impl(
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

pub(crate) fn fail_task_impl(
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

pub(crate) fn bind_task_session_impl(
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

pub(crate) fn mark_interrupted_impl(
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

pub(crate) fn pause_impl(
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

pub(crate) fn resume_impl(
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

pub(crate) fn cancel_impl(
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

pub(crate) fn retry_task_impl(
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

pub(crate) fn snapshot_impl(
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

pub(crate) fn attach_impl(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    on_event: Channel<OrchestrationEvent>,
) -> Result<String, String> {
    runtime.attach(&run_id, on_event)
}

/// Activity feed for the monitor: newest-first persisted events for a run,
/// mirroring munder's logTail over log.jsonl. Read-only; records no event.
pub(crate) fn activity_log_impl(
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

pub(crate) fn detach_impl(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    attachment_token: Option<String>,
) -> Result<(), String> {
    runtime.detach(&run_id, attachment_token.as_deref())
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn mail_send_impl(
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
pub(crate) fn mail_unread_impl(
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

pub(crate) fn mail_inbox_impl(
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

pub(crate) fn mail_ack_impl(
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

pub(crate) fn mail_route_impl(
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
#[allow(clippy::too_many_arguments)]
pub(crate) fn hook_drain_impl(
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

pub(crate) fn wake_note_spawn_impl(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    pty_id: String,
) -> Result<(), String> {
    runtime.wake_note_spawn(pty_id.trim(), now_ms() as u64)
}

pub(crate) fn wake_note_hook_impl(
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

pub(crate) fn wake_decide_impl(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    workers: Vec<wake::WakeFacts>,
) -> Result<Vec<wake::WakeCandidate>, String> {
    runtime.wake_decide(&run_id, workers, now_ms() as u64)
}

pub(crate) fn wake_forget_impl(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    agent_id: String,
    pty_id: Option<String>,
) -> Result<(), String> {
    runtime.wake_forget(agent_id.trim(), pty_id.as_deref())
}

pub(crate) fn breaker_tick_impl(
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

pub(crate) fn breaker_level_impl(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    agent_id: String,
) -> Result<breaker::BreakerLevel, String> {
    runtime.breaker_level(run_id.trim(), agent_id.trim())
}

/// Resolve a worker launch line into an executable + argv triple without
/// spawning anything. Provider-agnostic: the caller supplies the
/// catalog-resolved command, auto flag, and model. Worker start (their call
/// site) stays the only spawner.
pub(crate) fn resolve_launch_impl(
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
pub(crate) fn agent_identity_impl(
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
pub(crate) fn memory_reindex_impl(
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
pub(crate) fn memory_search_impl(
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
pub(crate) fn board_note_impl(
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
pub(crate) fn spawn_list_impl(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
) -> Result<Vec<spawn_queue::PendingSpawnRequest>, String> {
    runtime.snapshot(&run_id)?;
    spawn_queue::list_pending(&run_id)
}

/// Claim a spawn request, archiving it to `spawn-requests/.done/`.
pub(crate) fn spawn_claim_impl(
    runtime: tauri::State<'_, OrchestrationRuntime>,
    run_id: String,
    id: String,
) -> Result<spawn_queue::PendingSpawnRequest, String> {
    runtime.snapshot(&run_id)?;
    spawn_queue::claim(&run_id, &id)
}
