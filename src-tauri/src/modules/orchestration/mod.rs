use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet, VecDeque},
    sync::{Arc, Mutex, RwLock},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::ipc::Channel;

pub mod commands;
mod worktree;

const SUPPORTED_MANIFEST_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum OrchestrationProvider {
    Codex,
    Claude,
    #[serde(rename = "cmd")]
    CommandCode,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSpec {
    pub id: String,
    pub name: String,
    pub role: String,
    pub provider: OrchestrationProvider,
    pub model: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestratorSpec {
    pub provider: OrchestrationProvider,
    pub model: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskSpec {
    pub id: String,
    pub title: String,
    pub instructions: String,
    pub assignee_id: String,
    pub depends_on: Vec<String>,
    pub write_access: bool,
    pub done_when: String,
    pub validation_commands: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestrationManifest {
    pub version: u32,
    pub title: String,
    pub goal: String,
    pub orchestrator: OrchestratorSpec,
    pub agents: Vec<AgentSpec>,
    pub tasks: Vec<TaskSpec>,
}

impl OrchestrationManifest {
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();
        if self.version != SUPPORTED_MANIFEST_VERSION {
            errors.push(format!(
                "Unsupported orchestration manifest version '{}'",
                self.version
            ));
        }
        if self.title.trim().is_empty() {
            errors.push("Orchestration title is required".to_string());
        }
        if self.goal.trim().is_empty() {
            errors.push("Orchestration goal is required".to_string());
        }

        let mut agent_ids = HashSet::new();
        for agent in &self.agents {
            if !agent_ids.insert(agent.id.as_str()) {
                errors.push(format!("Duplicate agent id '{}'", agent.id));
            }
        }
        let mut task_ids = HashSet::new();
        for task in &self.tasks {
            if !task_ids.insert(task.id.as_str()) {
                errors.push(format!("Duplicate task id '{}'", task.id));
            }
        }

        for task in &self.tasks {
            if !agent_ids.contains(task.assignee_id.as_str()) {
                errors.push(format!(
                    "Task '{}' references missing assignee '{}'",
                    task.id, task.assignee_id
                ));
            }
            for dependency in &task.depends_on {
                if dependency == &task.id {
                    errors.push(format!("Task '{}' cannot depend on itself", task.id));
                } else if !task_ids.contains(dependency.as_str()) {
                    errors.push(format!(
                        "Task '{}' references missing dependency '{}'",
                        task.id, dependency
                    ));
                }
            }
            if task
                .validation_commands
                .iter()
                .any(|command| command.trim().is_empty())
            {
                errors.push(format!(
                    "Task '{}' contains an empty validation command",
                    task.id
                ));
            }
        }
        if has_dependency_cycle(&self.tasks) {
            errors.push("Task graph contains a dependency cycle".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

fn has_dependency_cycle(tasks: &[TaskSpec]) -> bool {
    fn visit<'a>(
        task_id: &'a str,
        dependencies: &HashMap<&'a str, &'a [String]>,
        visiting: &mut HashSet<&'a str>,
        visited: &mut HashSet<&'a str>,
    ) -> bool {
        if visiting.contains(task_id) {
            return true;
        }
        if visited.contains(task_id) {
            return false;
        }
        visiting.insert(task_id);
        if let Some(task_dependencies) = dependencies.get(task_id) {
            for dependency in *task_dependencies {
                if dependencies.contains_key(dependency.as_str())
                    && visit(dependency, dependencies, visiting, visited)
                {
                    return true;
                }
            }
        }
        visiting.remove(task_id);
        visited.insert(task_id);
        false
    }

    let dependencies = tasks
        .iter()
        .map(|task| (task.id.as_str(), task.depends_on.as_slice()))
        .collect::<HashMap<_, _>>();
    let mut visiting = HashSet::new();
    let mut visited = HashSet::new();
    tasks
        .iter()
        .any(|task| visit(&task.id, &dependencies, &mut visiting, &mut visited))
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum OrchestrationRunStatus {
    AwaitingApproval,
    Running,
    Paused,
    ReviewRequired,
    Completed,
    Failed,
    Cancelled,
    Interrupted,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum OrchestrationTaskStatus {
    Draft,
    Queued,
    Running,
    Validating,
    Completed,
    Blocked,
    Failed,
    Cancelled,
    Interrupted,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskExecution {
    pub task_id: String,
    pub status: OrchestrationTaskStatus,
    pub attempt: u32,
    pub result: Option<String>,
    pub chat_id: Option<String>,
    pub runtime_session_id: Option<String>,
    pub branch_name: Option<String>,
    pub worktree_path: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestrationRun {
    pub id: String,
    pub workspace_id: String,
    pub cwd: String,
    pub source_commit: Option<String>,
    pub integration_branch: Option<String>,
    pub integration_worktree: Option<String>,
    pub revision: u64,
    pub status: OrchestrationRunStatus,
    pub manifest: OrchestrationManifest,
    pub tasks: Vec<TaskExecution>,
}

impl OrchestrationRun {
    pub fn new(
        id: impl Into<String>,
        workspace_id: impl Into<String>,
        cwd: impl Into<String>,
        manifest: OrchestrationManifest,
    ) -> Result<Self, Vec<String>> {
        manifest.validate()?;
        let tasks = draft_task_executions(&manifest);
        Ok(Self {
            id: id.into(),
            workspace_id: workspace_id.into(),
            cwd: cwd.into(),
            source_commit: None,
            integration_branch: None,
            integration_worktree: None,
            revision: 1,
            status: OrchestrationRunStatus::AwaitingApproval,
            manifest,
            tasks,
        })
    }

    pub fn update_draft(
        &mut self,
        expected_revision: u64,
        manifest: OrchestrationManifest,
    ) -> Result<u64, String> {
        self.require_revision(expected_revision)?;
        manifest.validate().map_err(|errors| errors.join("\n"))?;
        self.revision = self.revision.saturating_add(1);
        self.tasks = draft_task_executions(&manifest);
        self.manifest = manifest;
        self.status = OrchestrationRunStatus::AwaitingApproval;
        Ok(self.revision)
    }

    pub fn approve_and_start(&mut self, expected_revision: u64) -> Result<(), String> {
        self.require_revision(expected_revision)?;
        if self.status != OrchestrationRunStatus::AwaitingApproval {
            return Err("Orchestration run is not awaiting approval".to_string());
        }
        for task in &mut self.tasks {
            task.status = OrchestrationTaskStatus::Queued;
        }
        self.status = OrchestrationRunStatus::Running;
        Ok(())
    }

    pub fn admit_ready_tasks(&mut self, max_concurrency: usize) -> Vec<String> {
        if self.status != OrchestrationRunStatus::Running || max_concurrency == 0 {
            return Vec::new();
        }
        let mut running = self
            .tasks
            .iter()
            .filter(|task| {
                matches!(
                    task.status,
                    OrchestrationTaskStatus::Running | OrchestrationTaskStatus::Validating
                )
            })
            .count();
        let mut busy_agents = self
            .tasks
            .iter()
            .filter(|task| {
                matches!(
                    task.status,
                    OrchestrationTaskStatus::Running | OrchestrationTaskStatus::Validating
                )
            })
            .filter_map(|execution| {
                self.manifest
                    .tasks
                    .iter()
                    .find(|task| task.id == execution.task_id)
                    .map(|task| task.assignee_id.clone())
            })
            .collect::<HashSet<_>>();
        let completed = self
            .tasks
            .iter()
            .filter(|task| task.status == OrchestrationTaskStatus::Completed)
            .map(|task| task.task_id.clone())
            .collect::<HashSet<_>>();
        let specs = self.manifest.tasks.clone();
        let mut admitted = Vec::new();

        for spec in specs {
            if running >= max_concurrency || busy_agents.contains(&spec.assignee_id) {
                continue;
            }
            if !spec
                .depends_on
                .iter()
                .all(|dependency| completed.contains(dependency))
            {
                continue;
            }
            let Some(execution) = self.tasks.iter_mut().find(|task| task.task_id == spec.id) else {
                continue;
            };
            if execution.status != OrchestrationTaskStatus::Queued {
                continue;
            }
            execution.status = OrchestrationTaskStatus::Running;
            execution.attempt = execution.attempt.saturating_add(1);
            busy_agents.insert(spec.assignee_id);
            running += 1;
            admitted.push(spec.id);
        }
        admitted
    }

    pub fn begin_validation(&mut self, task_id: &str) -> Result<(), String> {
        let task = self.task_mut(task_id)?;
        if task.status != OrchestrationTaskStatus::Running {
            return Err(format!("Task '{task_id}' is not running"));
        }
        task.status = OrchestrationTaskStatus::Validating;
        Ok(())
    }

    pub fn complete_task(&mut self, task_id: &str, result: &str) -> Result<(), String> {
        let task = self.task_mut(task_id)?;
        if task.status != OrchestrationTaskStatus::Validating {
            return Err(format!("Task '{task_id}' is not validating"));
        }
        task.status = OrchestrationTaskStatus::Completed;
        task.result = Some(result.to_string());
        if self
            .tasks
            .iter()
            .all(|execution| execution.status == OrchestrationTaskStatus::Completed)
        {
            self.status = OrchestrationRunStatus::ReviewRequired;
        }
        Ok(())
    }

    pub fn fail_task(&mut self, task_id: &str, error: &str) -> Result<(), String> {
        let task = self.task_mut(task_id)?;
        if !matches!(
            task.status,
            OrchestrationTaskStatus::Running | OrchestrationTaskStatus::Validating
        ) {
            return Err(format!("Task '{task_id}' is not active"));
        }
        task.status = OrchestrationTaskStatus::Failed;
        task.result = Some(error.to_string());
        self.status = OrchestrationRunStatus::Failed;
        Ok(())
    }

    pub fn block_task(&mut self, task_id: &str, error: &str) -> Result<(), String> {
        let task = self.task_mut(task_id)?;
        if !matches!(
            task.status,
            OrchestrationTaskStatus::Running | OrchestrationTaskStatus::Validating
        ) {
            return Err(format!("Task '{task_id}' is not active"));
        }
        task.status = OrchestrationTaskStatus::Blocked;
        task.result = Some(error.to_string());

        let mut blocked = HashSet::from([task_id.to_string()]);
        loop {
            let newly_blocked = self
                .manifest
                .tasks
                .iter()
                .filter(|spec| {
                    spec.depends_on
                        .iter()
                        .any(|dependency| blocked.contains(dependency))
                })
                .map(|spec| spec.id.clone())
                .filter(|id| !blocked.contains(id))
                .collect::<Vec<_>>();
            if newly_blocked.is_empty() {
                break;
            }
            for id in newly_blocked {
                if let Some(execution) = self.tasks.iter_mut().find(|task| task.task_id == id) {
                    if matches!(
                        execution.status,
                        OrchestrationTaskStatus::Draft | OrchestrationTaskStatus::Queued
                    ) {
                        execution.status = OrchestrationTaskStatus::Blocked;
                        execution.result = Some(format!("Blocked by dependency '{task_id}'"));
                    }
                }
                blocked.insert(id);
            }
        }
        self.status = OrchestrationRunStatus::Failed;
        Ok(())
    }

    pub fn pause(&mut self) -> Result<(), String> {
        if self.status != OrchestrationRunStatus::Running {
            return Err("Only a running orchestration can be paused".to_string());
        }
        self.status = OrchestrationRunStatus::Paused;
        Ok(())
    }

    pub fn resume(&mut self) -> Result<(), String> {
        if !matches!(
            self.status,
            OrchestrationRunStatus::Paused | OrchestrationRunStatus::Interrupted
        ) {
            return Err("Only a paused or interrupted orchestration can resume".to_string());
        }
        for task in &mut self.tasks {
            if task.status == OrchestrationTaskStatus::Interrupted {
                task.status = OrchestrationTaskStatus::Queued;
            }
        }
        self.status = OrchestrationRunStatus::Running;
        Ok(())
    }

    pub fn interrupt_active(&mut self) {
        if !matches!(
            self.status,
            OrchestrationRunStatus::Running | OrchestrationRunStatus::Paused
        ) {
            return;
        }
        for task in &mut self.tasks {
            if matches!(
                task.status,
                OrchestrationTaskStatus::Running | OrchestrationTaskStatus::Validating
            ) {
                task.status = OrchestrationTaskStatus::Interrupted;
            }
        }
        self.status = OrchestrationRunStatus::Interrupted;
    }

    fn task_mut(&mut self, task_id: &str) -> Result<&mut TaskExecution, String> {
        self.tasks
            .iter_mut()
            .find(|task| task.task_id == task_id)
            .ok_or_else(|| format!("Unknown orchestration task '{task_id}'"))
    }

    fn require_revision(&self, expected_revision: u64) -> Result<(), String> {
        if self.revision == expected_revision {
            Ok(())
        } else {
            Err("Stale orchestration revision".to_string())
        }
    }
}

fn draft_task_executions(manifest: &OrchestrationManifest) -> Vec<TaskExecution> {
    manifest
        .tasks
        .iter()
        .map(|task| TaskExecution {
            task_id: task.id.clone(),
            status: OrchestrationTaskStatus::Draft,
            attempt: 0,
            result: None,
            chat_id: None,
            runtime_session_id: None,
            branch_name: None,
            worktree_path: None,
        })
        .collect()
}

const ORCHESTRATION_REPLAY_LIMIT: usize = 256;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum OrchestrationEventType {
    RunCreated,
    DraftUpdated,
    RevisionRequested,
    Approved,
    TaskStarted,
    TaskCompleted,
    TaskFailed,
    TaskBlocked,
    TaskActivity,
    RunPaused,
    RunResumed,
    RunCancelled,
    Interrupted,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrchestrationEvent {
    pub sequence: u64,
    pub run_id: String,
    pub task_id: Option<String>,
    pub event_type: OrchestrationEventType,
    pub timestamp: i64,
    pub payload: Value,
}

#[derive(Default)]
struct OrchestrationEventSinkState {
    next_sequence: u64,
    generation: u64,
    channel: Option<Channel<OrchestrationEvent>>,
    replay: VecDeque<OrchestrationEvent>,
}

#[derive(Default)]
struct OrchestrationEventSink {
    state: Mutex<OrchestrationEventSinkState>,
}

impl OrchestrationEventSink {
    fn restore(&self, events: Vec<OrchestrationEvent>) -> Result<(), String> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| "orchestration event state lock poisoned".to_string())?;
        state.next_sequence = events.iter().map(|event| event.sequence).max().unwrap_or(0);
        state.replay = events
            .into_iter()
            .rev()
            .take(ORCHESTRATION_REPLAY_LIMIT)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();
        Ok(())
    }

    fn record(
        &self,
        run_id: &str,
        task_id: Option<String>,
        event_type: OrchestrationEventType,
        payload: Value,
    ) -> Result<OrchestrationEvent, String> {
        let (event, generation, channel) = {
            let mut state = self
                .state
                .lock()
                .map_err(|_| "orchestration event state lock poisoned".to_string())?;
            state.next_sequence = state.next_sequence.saturating_add(1);
            let event = OrchestrationEvent {
                sequence: state.next_sequence,
                run_id: run_id.to_string(),
                task_id,
                event_type,
                timestamp: now_ms(),
                payload,
            };
            state.replay.push_back(event.clone());
            while state.replay.len() > ORCHESTRATION_REPLAY_LIMIT {
                state.replay.pop_front();
            }
            (event, state.generation, state.channel.clone())
        };
        if let Some(channel) = channel {
            if channel.send(event.clone()).is_err() {
                self.clear_channel_if_current(generation);
            }
        }
        Ok(event)
    }

    fn attach(&self, channel: Channel<OrchestrationEvent>) -> Result<String, String> {
        let (generation, replay) = {
            let mut state = self
                .state
                .lock()
                .map_err(|_| "orchestration event state lock poisoned".to_string())?;
            state.generation = state.generation.wrapping_add(1);
            let generation = state.generation;
            state.channel = Some(channel);
            (generation, state.replay.iter().cloned().collect::<Vec<_>>())
        };
        self.deliver_replay(generation, replay)?;
        Ok(generation.to_string())
    }

    fn detach(&self, attachment_token: Option<&str>) -> Result<(), String> {
        let Some(token) = attachment_token else {
            return Ok(());
        };
        let Ok(generation) = token.parse::<u64>() else {
            return Ok(());
        };
        let mut state = self
            .state
            .lock()
            .map_err(|_| "orchestration event state lock poisoned".to_string())?;
        if state.generation == generation {
            state.generation = state.generation.wrapping_add(1);
            state.channel = None;
        }
        Ok(())
    }

    fn deliver_replay(
        &self,
        generation: u64,
        replay: Vec<OrchestrationEvent>,
    ) -> Result<(), String> {
        let channel = self
            .state
            .lock()
            .map_err(|_| "orchestration event state lock poisoned".to_string())?
            .channel
            .clone();
        let Some(channel) = channel else {
            return Ok(());
        };
        for event in replay {
            if channel.send(event).is_err() {
                self.clear_channel_if_current(generation);
                return Ok(());
            }
        }
        Ok(())
    }

    fn clear_channel_if_current(&self, generation: u64) {
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        if state.generation == generation {
            state.channel = None;
        }
    }
}

#[derive(Clone, Default)]
pub struct OrchestrationRuntime {
    runs: Arc<RwLock<HashMap<String, OrchestrationRun>>>,
    sinks: Arc<RwLock<HashMap<String, Arc<OrchestrationEventSink>>>>,
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
            .insert(id, Arc::new(OrchestrationEventSink::default()));
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
            .insert(run.id.clone(), Arc::new(OrchestrationEventSink::default()));
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

    pub fn update_draft(
        &self,
        run_id: &str,
        expected_revision: u64,
        manifest: OrchestrationManifest,
    ) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, |run| {
            run.update_draft(expected_revision, manifest)?;
            Ok(())
        })
    }

    pub fn approve_and_start(
        &self,
        run_id: &str,
        expected_revision: u64,
    ) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, |run| run.approve_and_start(expected_revision))
    }

    pub fn admit_ready_tasks(
        &self,
        run_id: &str,
        max_concurrency: usize,
    ) -> Result<(OrchestrationRun, Vec<String>), String> {
        let mut runs = self
            .runs
            .write()
            .map_err(|_| "orchestration runtime lock poisoned".to_string())?;
        let run = runs
            .get_mut(run_id)
            .ok_or_else(|| format!("Unknown orchestration run '{run_id}'"))?;
        let admitted = run.admit_ready_tasks(max_concurrency);
        Ok((run.clone(), admitted))
    }

    pub fn prepare_task_worktree(
        &self,
        run_id: &str,
        task_id: &str,
        workspace: &crate::modules::workspace::WorkspaceEnv,
    ) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, |run| {
            worktree::prepare_task_worktree(run, task_id, workspace).map(|_| ())
        })
    }

    pub fn complete_task(
        &self,
        run_id: &str,
        task_id: &str,
        result: &str,
    ) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, |run| run.complete_task(task_id, result))
    }

    pub fn bind_task_session(
        &self,
        run_id: &str,
        task_id: &str,
        chat_id: &str,
        runtime_session_id: &str,
    ) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, |run| {
            let task = run.task_mut(task_id)?;
            if task.status != OrchestrationTaskStatus::Running {
                return Err(format!("Task '{task_id}' is not running"));
            }
            task.chat_id = Some(chat_id.to_string());
            task.runtime_session_id = Some(runtime_session_id.to_string());
            Ok(())
        })
    }

    pub fn integrate_task(&self, run_id: &str, task_id: &str) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, |run| worktree::integrate_task(run, task_id))
    }

    pub fn block_task(
        &self,
        run_id: &str,
        task_id: &str,
        error: &str,
    ) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, |run| run.block_task(task_id, error))
    }

    pub fn begin_validation(
        &self,
        run_id: &str,
        task_id: &str,
    ) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, |run| run.begin_validation(task_id))
    }

    pub fn fail_task(
        &self,
        run_id: &str,
        task_id: &str,
        error: &str,
    ) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, |run| run.fail_task(task_id, error))
    }

    pub fn pause(&self, run_id: &str) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, OrchestrationRun::pause)
    }

    pub fn resume(&self, run_id: &str) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, OrchestrationRun::resume)
    }

    pub fn cancel(&self, run_id: &str) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, |run| {
            run.status = OrchestrationRunStatus::Cancelled;
            for task in &mut run.tasks {
                if matches!(
                    task.status,
                    OrchestrationTaskStatus::Queued
                        | OrchestrationTaskStatus::Running
                        | OrchestrationTaskStatus::Validating
                ) {
                    task.status = OrchestrationTaskStatus::Cancelled;
                }
            }
            Ok(())
        })
    }

    pub fn retry_task(&self, run_id: &str, task_id: &str) -> Result<OrchestrationRun, String> {
        self.mutate(run_id, |run| {
            let task = run.task_mut(task_id)?;
            if !matches!(
                task.status,
                OrchestrationTaskStatus::Failed
                    | OrchestrationTaskStatus::Interrupted
                    | OrchestrationTaskStatus::Blocked
            ) {
                return Err(format!("Task '{task_id}' cannot be retried"));
            }
            task.status = OrchestrationTaskStatus::Queued;
            task.result = None;
            if matches!(
                run.status,
                OrchestrationRunStatus::Failed | OrchestrationRunStatus::Interrupted
            ) {
                run.status = OrchestrationRunStatus::Running;
            }
            Ok(())
        })
    }

    pub fn interrupt_active_runs(&self) -> Result<Vec<OrchestrationRun>, String> {
        let mut runs = self
            .runs
            .write()
            .map_err(|_| "orchestration runtime lock poisoned".to_string())?;
        let mut interrupted = Vec::new();
        for run in runs.values_mut() {
            if matches!(
                run.status,
                OrchestrationRunStatus::Running | OrchestrationRunStatus::Paused
            ) {
                run.interrupt_active();
                interrupted.push(run.clone());
            }
        }
        Ok(interrupted)
    }

    pub fn record_event(
        &self,
        run_id: &str,
        task_id: Option<String>,
        event_type: OrchestrationEventType,
        payload: Value,
    ) -> Result<OrchestrationEvent, String> {
        self.snapshot(run_id)?;
        self.sink(run_id)?
            .record(run_id, task_id, event_type, payload)
    }

    pub fn attach(
        &self,
        run_id: &str,
        channel: Channel<OrchestrationEvent>,
    ) -> Result<String, String> {
        self.snapshot(run_id)?;
        self.sink(run_id)?.attach(channel)
    }

    pub fn detach(&self, run_id: &str, attachment_token: Option<&str>) -> Result<(), String> {
        self.sink(run_id)?.detach(attachment_token)
    }

    fn mutate(
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

    fn sink(&self, run_id: &str) -> Result<Arc<OrchestrationEventSink>, String> {
        self.sinks
            .read()
            .map_err(|_| "orchestration event registry lock poisoned".to_string())?
            .get(run_id)
            .cloned()
            .ok_or_else(|| format!("Unknown orchestration run '{run_id}'"))
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

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(i64::MAX))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::{
        AgentSpec, OrchestrationEvent, OrchestrationEventType, OrchestrationManifest,
        OrchestrationProvider, OrchestrationRun, OrchestrationRunStatus, OrchestrationRuntime,
        OrchestrationTaskStatus, OrchestratorSpec, TaskSpec,
    };
    use std::path::Path;

    fn manifest() -> OrchestrationManifest {
        OrchestrationManifest {
            version: 1,
            title: "Canvas orchestration".to_string(),
            goal: "Build the approved graph".to_string(),
            orchestrator: OrchestratorSpec {
                provider: OrchestrationProvider::Codex,
                model: None,
            },
            agents: vec![
                AgentSpec {
                    id: "builder".to_string(),
                    name: "Builder".to_string(),
                    role: "Implementation".to_string(),
                    provider: OrchestrationProvider::Claude,
                    model: None,
                },
                AgentSpec {
                    id: "reviewer".to_string(),
                    name: "Reviewer".to_string(),
                    role: "Verification".to_string(),
                    provider: OrchestrationProvider::CommandCode,
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
        let names = super::worktree::worktree_names(
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
}
