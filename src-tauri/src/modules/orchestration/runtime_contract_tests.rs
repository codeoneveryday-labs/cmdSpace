//! Contract tests for the orchestration runtime facade.
//!
//! These tests intentionally exercise the public runtime seam rather than
//! private registry fields. Domain transition tests remain next to the pure
//! state machine in `runtime.rs`/`run_state.rs`.

#[cfg(test)]
mod tests {
    use crate::modules::orchestration::{
        AgentSpec, OrchestrationManifest, OrchestrationRunStatus, OrchestrationRuntime,
        OrchestratorSpec, TaskSpec,
    };

    fn manifest() -> OrchestrationManifest {
        OrchestrationManifest {
            version: 1,
            title: "Runtime facade contract".to_string(),
            goal: "Verify public orchestration ownership".to_string(),
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
    fn runtime_facade_rejects_a_second_active_run_for_the_same_workspace() {
        let runtime = OrchestrationRuntime::default();
        runtime
            .create_run("run-1", "workspace-1", "/repo", manifest())
            .expect("first run should be created");

        let error = runtime
            .create_run("run-2", "workspace-1", "/repo", manifest())
            .expect_err("second active run should be rejected");

        assert_eq!(
            error,
            "Workspace 'workspace-1' already has an active orchestration run"
        );
    }

    #[test]
    fn runtime_facade_snapshot_returns_the_current_run_state() {
        let runtime = OrchestrationRuntime::default();
        runtime
            .create_run("run-1", "workspace-1", "/repo", manifest())
            .expect("run should be created");

        let snapshot = runtime.snapshot("run-1").expect("snapshot should exist");

        assert_eq!(snapshot.status, OrchestrationRunStatus::AwaitingApproval);
        assert_eq!(snapshot.tasks.len(), 1);
    }
}
