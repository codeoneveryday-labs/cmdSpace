//! Contract tests for the pure orchestration state machine.

#[cfg(test)]
mod tests {
    use crate::modules::orchestration::{
        AgentSpec, OrchestrationManifest, OrchestrationRun, OrchestrationRunStatus,
        OrchestrationTaskStatus, OrchestratorSpec, TaskSpec,
    };

    fn manifest() -> OrchestrationManifest {
        OrchestrationManifest {
            version: 1,
            title: "State machine contract".to_string(),
            goal: "Verify pure transitions".to_string(),
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

    #[test]
    fn approval_queues_tasks_without_starting_them() {
        let mut run = OrchestrationRun::new("run-1", "workspace-1", "/repo", manifest())
            .expect("valid manifest");

        run.approve_and_start(run.revision)
            .expect("approval should succeed");

        assert_eq!(run.status, OrchestrationRunStatus::Running);
        assert_eq!(run.tasks[0].status, OrchestrationTaskStatus::Queued);
    }

    #[test]
    fn scheduler_starts_a_ready_task_and_increments_attempt() {
        let mut run = OrchestrationRun::new("run-1", "workspace-1", "/repo", manifest())
            .expect("valid manifest");
        run.approve_and_start(1).expect("approval should succeed");

        let admitted = run.admit_ready_tasks(1);

        assert_eq!(admitted, vec!["build"]);
        assert_eq!(run.tasks[0].status, OrchestrationTaskStatus::Running);
        assert_eq!(run.tasks[0].attempt, 1);
    }
}
