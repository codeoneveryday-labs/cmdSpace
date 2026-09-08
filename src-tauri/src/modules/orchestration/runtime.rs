//! Runtime registry facade for Canvas orchestration.
//!
//! State transitions and policy coordination live in companion modules.

use super::event_sink::EventSink;
use super::model::{
    OrchestrationEvent, OrchestrationManifest, OrchestrationRun, OrchestrationRunStatus,
};
use super::{breaker, wake};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex, RwLock},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Default)]
pub struct OrchestrationRuntime {
    pub(crate) runs: Arc<RwLock<HashMap<String, OrchestrationRun>>>,
    sinks: Arc<RwLock<HashMap<String, Arc<EventSink>>>>,
    pub(crate) wake: Arc<Mutex<wake::WakeWatchdog>>,
    pub(crate) breaker: Arc<Mutex<breaker::CircuitBreaker>>,
}

impl OrchestrationRuntime {
    pub fn create_run(
        &self,
        id: impl Into<String>,
        workspace_id: impl Into<String>,
        cwd: impl Into<String>,
        manifest: OrchestrationManifest,
    ) -> Result<OrchestrationRun, String> {
        let id = id.into();
        let workspace_id = workspace_id.into();
        let run = OrchestrationRun::new(id.clone(), workspace_id.clone(), cwd, manifest)
            .map_err(|errors| errors.join("\n"))?;
        let mut runs = self
            .runs
            .write()
            .map_err(|_| "orchestration runtime lock poisoned".to_string())?;
        if runs.values().any(|candidate| {
            candidate.workspace_id == workspace_id && is_active_run(candidate.status)
        }) {
            return Err(format!(
                "Workspace '{workspace_id}' already has an active orchestration run"
            ));
        }
        runs.insert(id.clone(), run.clone());
        self.sinks
            .write()
            .map_err(|_| "orchestration event registry lock poisoned".to_string())?
            .insert(id, Arc::new(EventSink::default()));
        Ok(run)
    }

    pub fn snapshot(&self, run_id: &str) -> Result<OrchestrationRun, String> {
        self.runs
            .read()
            .map_err(|_| "orchestration runtime lock poisoned".to_string())?
            .get(run_id)
            .cloned()
            .ok_or_else(|| format!("Unknown orchestration run '{run_id}'"))
    }

    pub fn restore_run(&self, run: OrchestrationRun) -> Result<OrchestrationRun, String> {
        let mut runs = self
            .runs
            .write()
            .map_err(|_| "orchestration runtime lock poisoned".to_string())?;
        if let Some(existing) = runs.get(&run.id) {
            return Ok(existing.clone());
        }
        if runs.values().any(|candidate| {
            candidate.workspace_id == run.workspace_id && is_active_run(candidate.status)
        }) && is_active_run(run.status)
        {
            return Err(format!(
                "Workspace '{}' already has an active orchestration run",
                run.workspace_id
            ));
        }
        self.sinks
            .write()
            .map_err(|_| "orchestration event registry lock poisoned".to_string())?
            .insert(run.id.clone(), Arc::new(EventSink::default()));
        runs.insert(run.id.clone(), run.clone());
        Ok(run)
    }

    pub fn restore_run_with_events(
        &self,
        run: OrchestrationRun,
        events: Vec<OrchestrationEvent>,
    ) -> Result<OrchestrationRun, String> {
        let restored = self.restore_run(run)?;
        self.sink(&restored.id)?.restore(events)?;
        Ok(restored)
    }

    pub(crate) fn sink(&self, run_id: &str) -> Result<Arc<EventSink>, String> {
        self.sinks
            .read()
            .map_err(|_| "orchestration event registry lock poisoned".to_string())?
            .get(run_id)
            .cloned()
            .ok_or_else(|| format!("Unknown orchestration run '{run_id}'"))
    }

    pub(crate) fn mutate(
        &self,
        run_id: &str,
        operation: impl FnOnce(&mut OrchestrationRun) -> Result<(), String>,
    ) -> Result<OrchestrationRun, String> {
        let mut runs = self
            .runs
            .write()
            .map_err(|_| "orchestration runtime lock poisoned".to_string())?;
        let run = runs
            .get_mut(run_id)
            .ok_or_else(|| format!("Unknown orchestration run '{run_id}'"))?;
        operation(run)?;
        Ok(run.clone())
    }
}

fn is_active_run(status: OrchestrationRunStatus) -> bool {
    !matches!(
        status,
        OrchestrationRunStatus::Completed
            | OrchestrationRunStatus::Cancelled
            | OrchestrationRunStatus::Failed
    )
}

pub(crate) fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(i64::MAX))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::{OrchestrationEvent, OrchestrationRuntime};
    use crate::modules::orchestration::worktree;
    use crate::modules::orchestration::{
        AgentSpec, OrchestrationEventType, OrchestrationManifest, OrchestrationRun,
        OrchestrationRunStatus, OrchestrationTaskStatus, OrchestratorSpec, TaskSpec,
    };
    use std::path::Path;

    fn manifest() -> OrchestrationManifest {
        OrchestrationManifest {
            version: 1,
            title: "Canvas orchestration".to_string(),
            goal: "Build the approved graph".to_string(),
            orchestrator: OrchestratorSpec {
                provider: "codex".to_string(),
                model: None,
            },
            agents: vec![
                AgentSpec {
                    id: "builder".to_string(),
                    name: "Builder".to_string(),
                    role: "Implementation".to_string(),
                    provider: "claude".to_string(),
                    model: None,
                },
                AgentSpec {
                    id: "reviewer".to_string(),
                    name: "Reviewer".to_string(),
                    role: "Verification".to_string(),
                    provider: "cmd".to_string(),
                    model: None,
                },
            ],
            tasks: vec![
                task("build-1", "builder", &[]),
                task("build-2", "builder", &[]),
                task("review", "reviewer", &["build-1", "build-2"]),
            ],
        }
    }

    fn task(id: &str, assignee_id: &str, depends_on: &[&str]) -> TaskSpec {
        TaskSpec {
            id: id.to_string(),
            title: id.to_string(),
            instructions: format!("Execute {id}"),
            assignee_id: assignee_id.to_string(),
            depends_on: depends_on
                .iter()
                .map(|value| (*value).to_string())
                .collect(),
            write_access: true,
            done_when: "Tests pass".to_string(),
            validation_commands: vec!["pnpm test".to_string()],
        }
    }

    #[test]
    fn manifest_rejects_missing_assignees_and_dependency_cycles() {
        let mut input = manifest();
        input.tasks[0].assignee_id = "missing".to_string();
        input.tasks[0].depends_on = vec!["review".to_string()];

        assert_eq!(
            input.validate(),
            Err(vec![
                "Task 'build-1' references missing assignee 'missing'".to_string(),
                "Task graph contains a dependency cycle".to_string(),
            ])
        );
    }

    #[test]
    fn scheduler_respects_dependencies_concurrency_and_one_task_per_agent() {
        let mut run = OrchestrationRun::new("run-1", "workspace-1", "/repo", manifest()).unwrap();
        run.approve_and_start(1).unwrap();

        assert_eq!(run.admit_ready_tasks(3), vec!["build-1"]);
        assert_eq!(
            run.tasks
                .iter()
                .find(|task| task.task_id == "build-2")
                .map(|task| task.status),
            Some(OrchestrationTaskStatus::Queued)
        );
        run.begin_validation("build-1").unwrap();
        run.complete_task("build-1", "first done").unwrap();
        assert_eq!(run.admit_ready_tasks(3), vec!["build-2"]);
        run.begin_validation("build-2").unwrap();
        run.complete_task("build-2", "second done").unwrap();
        assert_eq!(run.admit_ready_tasks(3), vec!["review"]);
    }

    #[test]
    fn merge_conflict_blocks_downstream_tasks_without_running_them() {
        let mut run = OrchestrationRun::new("run-1", "workspace-1", "/repo", manifest()).unwrap();
        run.approve_and_start(1).unwrap();
        assert_eq!(run.admit_ready_tasks(3), vec!["build-1"]);
        run.block_task("build-1", "integration conflict").unwrap();

        assert_eq!(run.status, OrchestrationRunStatus::Failed);
        assert_eq!(
            run.tasks
                .iter()
                .find(|task| task.task_id == "build-1")
                .map(|task| task.status),
            Some(OrchestrationTaskStatus::Blocked)
        );
        assert_eq!(
            run.tasks
                .iter()
                .find(|task| task.task_id == "review")
                .map(|task| task.status),
            Some(OrchestrationTaskStatus::Blocked)
        );
        assert!(run.admit_ready_tasks(3).is_empty());
    }

    #[test]
    fn approval_rejects_stale_revisions() {
        let mut run = OrchestrationRun::new("run-1", "workspace-1", "/repo", manifest()).unwrap();
        let revision = run.update_draft(1, manifest()).unwrap();

        assert_eq!(revision, 2);
        assert_eq!(
            run.approve_and_start(1),
            Err("Stale orchestration revision".to_string())
        );
        run.approve_and_start(2).unwrap();
        assert_eq!(run.status, OrchestrationRunStatus::Running);
    }

    #[test]
    fn restart_marks_active_work_interrupted_without_auto_resume() {
        let mut run = OrchestrationRun::new("run-1", "workspace-1", "/repo", manifest()).unwrap();
        run.approve_and_start(1).unwrap();
        assert_eq!(run.admit_ready_tasks(3), vec!["build-1"]);

        run.interrupt_active();

        assert_eq!(run.status, OrchestrationRunStatus::Interrupted);
        assert_eq!(
            run.tasks
                .iter()
                .find(|task| task.task_id == "build-1")
                .map(|task| task.status),
            Some(OrchestrationTaskStatus::Interrupted)
        );
    }

    #[test]
    fn runtime_allows_only_one_active_run_per_workspace() {
        let runtime = OrchestrationRuntime::default();
        runtime
            .create_run("run-1", "workspace-1", "/repo", manifest())
            .unwrap();

        assert_eq!(
            runtime.create_run("run-2", "workspace-1", "/repo", manifest()),
            Err("Workspace 'workspace-1' already has an active orchestration run".to_string())
        );
    }

    #[test]
    fn runtime_replays_events_in_sequence_when_canvas_reattaches() {
        use std::sync::{Arc, Mutex};
        use tauri::ipc::Channel;

        let runtime = OrchestrationRuntime::default();
        runtime
            .create_run("run-1", "workspace-1", "/repo", manifest())
            .unwrap();
        runtime
            .record_event(
                "run-1",
                None,
                OrchestrationEventType::RunCreated,
                serde_json::json!({}),
            )
            .unwrap();
        runtime.detach("run-1", None).unwrap();
        runtime
            .record_event(
                "run-1",
                None,
                OrchestrationEventType::DraftUpdated,
                serde_json::json!({}),
            )
            .unwrap();

        let received = Arc::new(Mutex::new(Vec::<OrchestrationEvent>::new()));
        let captured = Arc::clone(&received);
        runtime
            .attach(
                "run-1",
                Channel::new(move |event| {
                    captured.lock().unwrap().push(event.deserialize().unwrap());
                    Ok(())
                }),
            )
            .unwrap();

        assert_eq!(
            received
                .lock()
                .unwrap()
                .iter()
                .map(|event| event.sequence)
                .collect::<Vec<_>>(),
            vec![1, 2]
        );
    }

    #[test]
    fn worktree_names_are_scoped_to_run_and_task() {
        let names = worktree::worktree_names(
            Path::new("/Users/demo/.cmdspace/worktrees"),
            "repo",
            "run-1",
            "build/api",
        );

        assert_eq!(names.branch, "cmdspace/orch-run-1-build-api");
        assert_eq!(
            names.path,
            Path::new("/Users/demo/.cmdspace/worktrees/repo/run-1/build-api")
        );
    }

    #[test]
    fn runtime_persists_task_chat_and_provider_session_identity() {
        let runtime = OrchestrationRuntime::default();
        runtime
            .create_run("run-1", "workspace-1", "/repo", manifest())
            .unwrap();
        runtime.approve_and_start("run-1", 1).unwrap();
        runtime.admit_ready_tasks("run-1", 3).unwrap();

        let run = runtime
            .bind_task_session("run-1", "build-1", "chat-1", "runtime-1")
            .unwrap();
        let task = run
            .tasks
            .iter()
            .find(|task| task.task_id == "build-1")
            .unwrap();
        assert_eq!(task.chat_id.as_deref(), Some("chat-1"));
        assert_eq!(task.runtime_session_id.as_deref(), Some("runtime-1"));
    }

    #[test]
    fn resume_sequence_readmits_interrupted_tasks() {
        let runtime = OrchestrationRuntime::default();
        runtime
            .create_run("run-1", "workspace-1", "/repo", manifest())
            .unwrap();
        runtime.approve_and_start("run-1", 1).unwrap();
        let (_, started) = runtime.admit_ready_tasks("run-1", 3).unwrap();
        assert_eq!(started, vec!["build-1"]);

        runtime.interrupt_active_runs().unwrap();
        let run = runtime.resume("run-1").unwrap();
        // Resume alone only re-queues; the command layer must admit after.
        assert_eq!(
            run.tasks
                .iter()
                .find(|task| task.task_id == "build-1")
                .map(|task| task.status),
            Some(OrchestrationTaskStatus::Queued)
        );
        let (run, started) = runtime.admit_ready_tasks("run-1", 3).unwrap();
        assert_eq!(started, vec!["build-1"]);
        assert_eq!(run.status, OrchestrationRunStatus::Running);
    }

    #[test]
    fn retry_sequence_readmits_the_failed_task() {
        let runtime = OrchestrationRuntime::default();
        runtime
            .create_run("run-1", "workspace-1", "/repo", manifest())
            .unwrap();
        runtime.approve_and_start("run-1", 1).unwrap();
        runtime.admit_ready_tasks("run-1", 3).unwrap();
        runtime.fail_task("run-1", "build-1", "boom").unwrap();

        let run = runtime.retry_task("run-1", "build-1").unwrap();
        assert_eq!(run.status, OrchestrationRunStatus::Running);
        let (_, started) = runtime.admit_ready_tasks("run-1", 3).unwrap();
        assert_eq!(started, vec!["build-1"]);
    }

    #[test]
    fn wake_policy_state_lives_on_the_runtime() {
        use crate::modules::orchestration::wake::{
            WakeFacts, WAKE_COOLDOWN_MS, WAKE_HITL_REARM_MS, WAKE_IDLE_MS, WAKE_NUDGE,
        };

        let runtime = OrchestrationRuntime::default();
        runtime
            .create_run("run-1", "workspace-1", "/repo", manifest())
            .unwrap();
        let facts = WakeFacts {
            agent_id: "builder".to_string(),
            is_orchestrator: false,
            pty_id: Some("pty-1".to_string()),
            last_output_at: 100_000,
            inbox_count: 1,
            delivery_paused: false,
            paused: false,
            halted: false,
        };
        let now = 100_000 + WAKE_IDLE_MS;
        let first = runtime
            .wake_decide("run-1", vec![facts.clone()], now)
            .unwrap();
        assert_eq!(first.len(), 1);
        assert_eq!(first[0].agent_id, "builder");
        assert_eq!(first[0].nudge, WAKE_NUDGE);
        assert!(runtime
            .wake_decide("run-1", vec![facts.clone()], now + 1)
            .unwrap()
            .is_empty());
        runtime
            .wake_note_hook("builder", Some("Notification"), Some("Approve this?"), now)
            .unwrap();
        assert!(runtime
            .wake_decide(
                "run-1",
                vec![facts.clone()],
                now + WAKE_COOLDOWN_MS + WAKE_IDLE_MS
            )
            .unwrap()
            .is_empty());
        assert_eq!(
            runtime
                .wake_decide(
                    "run-1",
                    vec![facts],
                    now + WAKE_HITL_REARM_MS + WAKE_COOLDOWN_MS + WAKE_IDLE_MS
                )
                .unwrap()
                .len(),
            1
        );
        assert!(runtime.wake_decide("missing", vec![], now).is_err());
        runtime.wake_note_spawn("pty-1", now).unwrap();
    }
}
