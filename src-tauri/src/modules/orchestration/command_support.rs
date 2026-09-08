use std::collections::HashSet;
use std::fs;

use serde_json::Value;

use super::{
    hive_files, mailbox, router, OrchestrationEvent, OrchestrationEventType, OrchestrationRun,
    OrchestrationRuntime,
};
use crate::modules::db::{append_orchestration_event_inner, save_orchestration_run_inner, DbState};

pub(crate) fn persist_run(db: &DbState, run: &OrchestrationRun) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|_| "DB mutex poisoned")?;
    save_orchestration_run_inner(&mut conn, run)?;
    hive_files::sync_run_files(run);
    Ok(())
}

pub(crate) fn record_event(
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

pub(crate) fn deliver_pending_mail(run: &OrchestrationRun) -> Result<router::RouteReport, String> {
    let members = mailbox::roster(&run.manifest);
    let root = mailbox::mailbox_root(&run.id)?;
    let mut pending = Vec::new();
    for member in &members {
        pending.extend(mailbox::read_message_dir(&mailbox::outbox_dir(
            &root, member,
        )));
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::db::{initialize_schema, load_orchestration_events_inner};
    use crate::modules::orchestration::{
        AgentSpec, OrchestrationManifest, OrchestratorSpec, TaskSpec,
    };
    use rusqlite::Connection;
    use std::sync::Mutex;

    fn manifest() -> OrchestrationManifest {
        OrchestrationManifest {
            version: 1,
            title: "Command support test".to_string(),
            goal: "Exercise persistence seams".to_string(),
            orchestrator: OrchestratorSpec {
                provider: "codex".to_string(),
                model: None,
            },
            agents: vec![AgentSpec {
                id: "builder".to_string(),
                name: "Builder".to_string(),
                role: "Implementation".to_string(),
                provider: "claude".to_string(),
                model: None,
            }],
            tasks: vec![TaskSpec {
                id: "build".to_string(),
                title: "Build".to_string(),
                instructions: "Implement".to_string(),
                assignee_id: "builder".to_string(),
                depends_on: Vec::new(),
                write_access: true,
                done_when: "Tests pass".to_string(),
                validation_commands: Vec::new(),
            }],
        }
    }

    fn test_db() -> DbState {
        let conn = Connection::open_in_memory().expect("open test database");
        initialize_schema(&conn).expect("initialize test schema");
        DbState(Mutex::new(conn))
    }

    #[test]
    fn persist_run_and_record_event_share_the_same_run_identity() {
        let db = test_db();
        let runtime = OrchestrationRuntime::default();
        let run = runtime
            .create_run("run-1", "workspace-1", "/repo", manifest())
            .expect("create run");

        persist_run(&db, &run).expect("persist run");
        let event = record_event(
            &runtime,
            &db,
            &run.id,
            Some("build".to_string()),
            OrchestrationEventType::TaskActivity,
            serde_json::json!({ "source": "test" }),
        )
        .expect("record event");

        let conn = db.0.lock().expect("lock test database");
        let events = load_orchestration_events_inner(&conn, "run-1").expect("load events");
        assert_eq!(events, vec![event]);
        assert_eq!(events[0].task_id.as_deref(), Some("build"));
        assert_eq!(events[0].payload["source"], "test");
    }

    #[test]
    fn approved_run_persists_running_task_and_start_event() {
        let db = test_db();
        let runtime = OrchestrationRuntime::default();
        let run = runtime
            .create_run("run-approval", "workspace-approval", "/repo", manifest())
            .expect("create run");

        let approved = runtime
            .approve_and_start(&run.id, run.revision)
            .expect("approve run");
        persist_run(&db, &approved).expect("persist approved run");
        record_event(
            &runtime,
            &db,
            &approved.id,
            None,
            OrchestrationEventType::Approved,
            Value::Null,
        )
        .expect("record approval");

        let (running, started) = runtime
            .admit_ready_tasks(&approved.id, 3)
            .expect("admit ready task");
        assert_eq!(started, vec!["build"]);
        persist_run(&db, &running).expect("persist running task");
        record_event(
            &runtime,
            &db,
            &running.id,
            Some("build".to_string()),
            OrchestrationEventType::TaskStarted,
            Value::Null,
        )
        .expect("record task start");

        let conn = db.0.lock().expect("lock test database");
        let stored = crate::modules::db::load_orchestration_run_inner(&conn, &running.id)
            .expect("load stored run")
            .expect("stored run exists");
        assert_eq!(
            stored.status,
            crate::modules::orchestration::OrchestrationRunStatus::Running
        );
        assert_eq!(
            stored.tasks[0].status,
            crate::modules::orchestration::OrchestrationTaskStatus::Running
        );
        let events = load_orchestration_events_inner(&conn, &running.id).expect("load events");
        assert_eq!(
            events
                .iter()
                .map(|event| &event.event_type)
                .collect::<Vec<_>>(),
            vec![
                &OrchestrationEventType::Approved,
                &OrchestrationEventType::TaskStarted,
            ]
        );
    }

    #[test]
    fn completed_task_persists_terminal_state_and_result_event() {
        let db = test_db();
        let runtime = OrchestrationRuntime::default();
        let run = runtime
            .create_run("run-complete", "workspace-complete", "/repo", manifest())
            .expect("create run");
        runtime.approve_and_start(&run.id, 1).expect("approve run");
        runtime.admit_ready_tasks(&run.id, 3).expect("admit task");
        runtime
            .begin_validation(&run.id, "build")
            .expect("begin validation");
        let completed = runtime
            .complete_task(&run.id, "build", "implemented")
            .expect("complete task");
        persist_run(&db, &completed).expect("persist completed task");
        let event = record_event(
            &runtime,
            &db,
            &completed.id,
            Some("build".to_string()),
            OrchestrationEventType::TaskCompleted,
            serde_json::json!({ "result": "implemented" }),
        )
        .expect("record completion");

        let conn = db.0.lock().expect("lock test database");
        let stored = crate::modules::db::load_orchestration_run_inner(&conn, &completed.id)
            .expect("load stored run")
            .expect("stored run exists");
        assert_eq!(
            stored.tasks[0].status,
            crate::modules::orchestration::OrchestrationTaskStatus::Completed
        );
        assert_eq!(stored.tasks[0].result.as_deref(), Some("implemented"));
        assert_eq!(
            load_orchestration_events_inner(&conn, &completed.id).expect("load events"),
            vec![event]
        );
    }

    #[test]
    fn failed_task_persists_failure_reason_and_failed_event() {
        let db = test_db();
        let runtime = OrchestrationRuntime::default();
        let run = runtime
            .create_run("run-fail", "workspace-fail", "/repo", manifest())
            .expect("create run");
        runtime.approve_and_start(&run.id, 1).expect("approve run");
        runtime.admit_ready_tasks(&run.id, 3).expect("admit task");
        let failed = runtime
            .fail_task(&run.id, "build", "validation failed")
            .expect("fail task");
        persist_run(&db, &failed).expect("persist failed task");
        let event = record_event(
            &runtime,
            &db,
            &failed.id,
            Some("build".to_string()),
            OrchestrationEventType::TaskFailed,
            serde_json::json!({ "error": "validation failed" }),
        )
        .expect("record failure");

        let conn = db.0.lock().expect("lock test database");
        let stored = crate::modules::db::load_orchestration_run_inner(&conn, &failed.id)
            .expect("load stored run")
            .expect("stored run exists");
        assert_eq!(
            stored.status,
            crate::modules::orchestration::OrchestrationRunStatus::Failed
        );
        assert_eq!(stored.tasks[0].result.as_deref(), Some("validation failed"));
        assert_eq!(
            load_orchestration_events_inner(&conn, &failed.id).expect("load events"),
            vec![event]
        );
    }

    #[test]
    fn resumed_run_persists_requeued_and_readmitted_task() {
        let db = test_db();
        let runtime = OrchestrationRuntime::default();
        let run = runtime
            .create_run("run-resume", "workspace-resume", "/repo", manifest())
            .expect("create run");
        runtime.approve_and_start(&run.id, 1).expect("approve run");
        runtime.admit_ready_tasks(&run.id, 3).expect("admit task");
        runtime.interrupt_active_runs().expect("interrupt run");
        let resumed = runtime.resume(&run.id).expect("resume run");
        persist_run(&db, &resumed).expect("persist resumed run");
        let (running, started) = runtime.admit_ready_tasks(&run.id, 3).expect("readmit task");
        assert_eq!(started, vec!["build"]);
        persist_run(&db, &running).expect("persist readmitted task");

        let conn = db.0.lock().expect("lock test database");
        let stored = crate::modules::db::load_orchestration_run_inner(&conn, &run.id)
            .expect("load stored run")
            .expect("stored run exists");
        assert_eq!(
            stored.status,
            crate::modules::orchestration::OrchestrationRunStatus::Running
        );
        assert_eq!(
            stored.tasks[0].status,
            crate::modules::orchestration::OrchestrationTaskStatus::Running
        );
        assert_eq!(stored.tasks[0].attempt, 2);
    }

    #[test]
    fn retried_failed_task_persists_a_new_attempt() {
        let db = test_db();
        let runtime = OrchestrationRuntime::default();
        let run = runtime
            .create_run("run-retry", "workspace-retry", "/repo", manifest())
            .expect("create run");
        runtime.approve_and_start(&run.id, 1).expect("approve run");
        runtime.admit_ready_tasks(&run.id, 3).expect("admit task");
        let failed = runtime
            .fail_task(&run.id, "build", "validation failed")
            .expect("fail task");
        persist_run(&db, &failed).expect("persist failed run");
        let retried = runtime.retry_task(&run.id, "build").expect("retry task");
        persist_run(&db, &retried).expect("persist retry");
        let (running, started) = runtime
            .admit_ready_tasks(&run.id, 3)
            .expect("readmit retry");
        assert_eq!(started, vec!["build"]);
        persist_run(&db, &running).expect("persist retried task");

        let conn = db.0.lock().expect("lock test database");
        let stored = crate::modules::db::load_orchestration_run_inner(&conn, &run.id)
            .expect("load stored run")
            .expect("stored run exists");
        assert_eq!(
            stored.status,
            crate::modules::orchestration::OrchestrationRunStatus::Running
        );
        assert_eq!(
            stored.tasks[0].status,
            crate::modules::orchestration::OrchestrationTaskStatus::Running
        );
        assert_eq!(stored.tasks[0].attempt, 2);
        assert_eq!(stored.tasks[0].result, None);
    }
}
