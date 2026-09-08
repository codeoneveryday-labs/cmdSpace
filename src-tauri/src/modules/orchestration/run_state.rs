//! Pure orchestration state machine with no native side effects.

use std::collections::HashSet;

use super::manifest::draft_task_executions;
use super::model::{
    OrchestrationManifest, OrchestrationRun, OrchestrationRunStatus, OrchestrationTaskStatus,
    TaskExecution,
};

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
            if running >= max_concurrency
                || busy_agents.contains(&spec.assignee_id)
                || !spec
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
    pub(crate) fn task_mut(&mut self, task_id: &str) -> Result<&mut TaskExecution, String> {
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
