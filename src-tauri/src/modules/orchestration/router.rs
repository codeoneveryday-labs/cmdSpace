use super::mailbox::{HiveMessage, BROADCAST_RECIPIENT, MAX_HOPS};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Delivery {
    pub message_id: String,
    pub from: String,
    pub to: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteReport {
    pub delivered: Vec<Delivery>,
    pub skipped: Vec<String>,
}

/// Pure delivery planning: which outbox messages move into which inboxes.
/// The caller performs the filesystem moves; this function only decides.
/// `already_filed` holds message ids already present in the destination inbox
/// or its `.done/` archive, making re-routing idempotent.
pub fn plan_delivery(
    messages: &[HiveMessage],
    roster: &[String],
    already_filed: &HashSet<String>,
) -> RouteReport {
    let mut delivered = Vec::new();
    let mut skipped = Vec::new();
    for message in messages {
        if message.hops > MAX_HOPS {
            skipped.push(message.id.clone());
            continue;
        }
        let recipients = resolve_recipients(message, roster);
        if recipients.is_empty() || already_filed.contains(&message.id) {
            skipped.push(message.id.clone());
            continue;
        }
        for recipient in recipients {
            delivered.push(Delivery {
                message_id: message.id.clone(),
                from: message.from.clone(),
                to: recipient,
            });
        }
    }
    RouteReport { delivered, skipped }
}

fn resolve_recipients(message: &HiveMessage, roster: &[String]) -> Vec<String> {
    if message.to == BROADCAST_RECIPIENT {
        return roster
            .iter()
            .filter(|id| *id != &message.from)
            .cloned()
            .collect();
    }
    if message.from == message.to {
        return Vec::new();
    }
    roster
        .iter()
        .filter(|id| *id == &message.to)
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{plan_delivery, Delivery};
    use crate::modules::orchestration::mailbox::{HiveAct, HiveMessage, MAX_HOPS};
    use std::collections::HashSet;

    fn roster() -> Vec<String> {
        vec![
            "builder".to_string(),
            "reviewer".to_string(),
            "orchestrator".to_string(),
        ]
    }

    fn message(id: &str, from: &str, to: &str, hops: u32) -> HiveMessage {
        HiveMessage {
            id: id.to_string(),
            conversation: "conv-1".to_string(),
            in_reply_to: None,
            from: from.to_string(),
            to: to.to_string(),
            act: HiveAct::Request,
            subject: "Help".to_string(),
            body: "Please review".to_string(),
            hops,
            requires_reply: true,
            needs_human: false,
            created_at: 1_756_000_000_000,
        }
    }

    #[test]
    fn direct_message_delivers_to_exactly_one_recipient() {
        let report = plan_delivery(
            &[message("m-1", "builder", "reviewer", 0)],
            &roster(),
            &HashSet::new(),
        );
        assert_eq!(
            report.delivered,
            vec![Delivery {
                message_id: "m-1".to_string(),
                from: "builder".to_string(),
                to: "reviewer".to_string(),
            }]
        );
        assert!(report.skipped.is_empty());
    }

    #[test]
    fn broadcast_fans_out_to_everyone_except_the_sender() {
        let report = plan_delivery(
            &[message("m-1", "builder", "broadcast", 0)],
            &roster(),
            &HashSet::new(),
        );
        let recipients = report
            .delivered
            .iter()
            .map(|delivery| delivery.to.clone())
            .collect::<Vec<_>>();
        assert_eq!(recipients, vec!["reviewer", "orchestrator"]);
        assert!(report.skipped.is_empty());
    }

    #[test]
    fn redelivery_unknown_recipients_and_over_hop_messages_are_skipped() {
        let filed = HashSet::from(["m-1".to_string()]);
        let report = plan_delivery(
            &[
                message("m-1", "builder", "reviewer", 0),
                message("m-2", "builder", "ghost", 0),
                message("m-3", "builder", "reviewer", MAX_HOPS + 1),
                message("m-4", "builder", "builder", 0),
            ],
            &roster(),
            &filed,
        );
        assert!(report.delivered.is_empty());
        assert_eq!(report.skipped, vec!["m-1", "m-2", "m-3", "m-4"]);
    }
}
