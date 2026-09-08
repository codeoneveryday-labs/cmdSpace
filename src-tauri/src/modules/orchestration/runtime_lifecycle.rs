//! Runtime facade for run lifecycle operations.

use super::model::{
    OrchestrationManifest, OrchestrationRun, OrchestrationRunStatus, OrchestrationTaskStatus,
};
use super::OrchestrationRuntime;

impl OrchestrationRuntime {
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
}
