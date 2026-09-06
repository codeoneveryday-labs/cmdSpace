use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum HookKind {
    Stop,
    Notification,
    PreToolUse,
    PostToolUse,
    SessionStart,
    Status,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentLiveness {
    Working,
    Idle,
    WaitingInput,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HookEvent {
    pub run_id: String,
    pub agent_id: String,
    pub kind: HookKind,
    pub message: Option<String>,
    pub tool: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DrainDecision {
    AllowStop,
    BlockWithNudge { nudge: String },
    RouteThenBlock { delivered: u32 },
}

pub fn decide(
    event: &HookEvent,
    inbox_count: u32,
    is_orchestrator: bool,
    nudge: &str,
) -> DrainDecision {
    if event.kind != HookKind::Stop {
        return DrainDecision::AllowStop;
    }
    if is_orchestrator || inbox_count == 0 {
        return DrainDecision::AllowStop;
    }
    if inbox_count > 0 {
        DrainDecision::RouteThenBlock {
            delivered: inbox_count,
        }
    } else {
        DrainDecision::BlockWithNudge {
            nudge: nudge.to_string(),
        }
    }
}

/// Lifecycle signal for the monitor: what the agent is doing right now,
/// derived from hook events instead of parsing PTY output.
pub fn liveness_for(kind: HookKind) -> AgentLiveness {
    match kind {
        HookKind::PreToolUse | HookKind::PostToolUse | HookKind::SessionStart => {
            AgentLiveness::Working
        }
        HookKind::Stop => AgentLiveness::Idle,
        HookKind::Notification | HookKind::Status => AgentLiveness::WaitingInput,
    }
}

#[cfg(test)]
mod tests {
    use super::{decide, liveness_for, AgentLiveness, DrainDecision, HookEvent, HookKind};

    fn stop(agent_id: &str) -> HookEvent {
        HookEvent {
            run_id: "run-1".to_string(),
            agent_id: agent_id.to_string(),
            kind: HookKind::Stop,
            message: None,
            tool: None,
            session_id: None,
        }
    }

    #[test]
    fn stop_with_mail_routes_then_blocks() {
        assert_eq!(
            decide(&stop("builder"), 2, false, "nudge"),
            DrainDecision::RouteThenBlock { delivered: 2 }
        );
    }

    #[test]
    fn stop_with_empty_inbox_allows() {
        assert_eq!(
            decide(&stop("builder"), 0, false, "nudge"),
            DrainDecision::AllowStop
        );
    }

    #[test]
    fn orchestrator_is_never_blocked() {
        assert_eq!(
            decide(&stop("orchestrator"), 3, true, "nudge"),
            DrainDecision::AllowStop
        );
    }

    #[test]
    fn notification_always_passes_through() {
        let event = HookEvent {
            kind: HookKind::Notification,
            ..stop("builder")
        };
        assert_eq!(decide(&event, 3, false, "nudge"), DrainDecision::AllowStop);
    }

    #[test]
    fn tool_and_session_hooks_pass_through_without_blocking() {
        for kind in [
            HookKind::PreToolUse,
            HookKind::PostToolUse,
            HookKind::SessionStart,
            HookKind::Status,
        ] {
            let event = HookEvent {
                kind,
                ..stop("builder")
            };
            assert_eq!(decide(&event, 3, false, "nudge"), DrainDecision::AllowStop);
        }
    }

    #[test]
    fn liveness_comes_from_hook_kind_not_pty_output() {
        assert_eq!(liveness_for(HookKind::PreToolUse), AgentLiveness::Working);
        assert_eq!(liveness_for(HookKind::PostToolUse), AgentLiveness::Working);
        assert_eq!(liveness_for(HookKind::SessionStart), AgentLiveness::Working);
        assert_eq!(liveness_for(HookKind::Stop), AgentLiveness::Idle);
        assert_eq!(
            liveness_for(HookKind::Notification),
            AgentLiveness::WaitingInput
        );
        assert_eq!(liveness_for(HookKind::Status), AgentLiveness::WaitingInput);
    }
}
