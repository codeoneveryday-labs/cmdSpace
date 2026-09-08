//! Contract tests for runtime policy and observer coordination.

#[cfg(test)]
mod tests {
    use crate::modules::orchestration::wake::{WakeFacts, WAKE_IDLE_MS, WAKE_NUDGE};
    use crate::modules::orchestration::{
        AgentSpec, OrchestrationManifest, OrchestrationRuntime, OrchestratorSpec, TaskSpec,
    };

    fn manifest() -> OrchestrationManifest {
        OrchestrationManifest {
            version: 1,
            title: "Coordination contract".to_string(),
            goal: "Verify runtime policy".to_string(),
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
                write_access: false,
                done_when: "Tests pass".to_string(),
                validation_commands: Vec::new(),
            }],
        }
    }

    #[test]
    fn wake_decision_validates_run_and_returns_a_nudge_for_idle_worker() {
        let runtime = OrchestrationRuntime::default();
        runtime
            .create_run("run-1", "workspace-1", "/repo", manifest())
            .expect("run should be created");
        let now = 100_000 + WAKE_IDLE_MS;
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

        let candidates = runtime
            .wake_decide("run-1", vec![facts], now)
            .expect("known run should be accepted");

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].agent_id, "builder");
        assert_eq!(candidates[0].nudge, WAKE_NUDGE);
    }

    #[test]
    fn wake_decision_rejects_an_unknown_run() {
        let runtime = OrchestrationRuntime::default();

        assert!(runtime.wake_decide("missing", Vec::new(), 1).is_err());
    }
}
