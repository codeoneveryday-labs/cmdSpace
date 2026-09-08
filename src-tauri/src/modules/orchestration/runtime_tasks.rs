//! Runtime facade for task admission and task coordination.

use super::model::{OrchestrationRun, OrchestrationTaskStatus};
use super::{worktree, OrchestrationRuntime};

impl OrchestrationRuntime {
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
}
