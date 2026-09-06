use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum HookKind {
    Stop,
    Notification,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HookEvent {
    pub run_id: String,
    pub agent_id: String,
    pub kind: HookKind,
    pub message: Option<String>,
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
    if is_orchestrator || event.kind == HookKind::Notification || inbox_count == 0 {
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

#[cfg(test)]
mod tests {
    use super::{decide, DrainDecision, HookEvent, HookKind};

    fn stop(agent_id: &str) -> HookEvent {
        HookEvent {
            run_id: "run-1".to_string(),
            agent_id: agent_id.to_string(),
            kind: HookKind::Stop,
            message: None,
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
}
