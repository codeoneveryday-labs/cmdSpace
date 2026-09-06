use super::OrchestrationManifest;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

/// Reserved sender/recipient: the Boss orchestrator CLI on the Canvas.
pub const ORCHESTRATOR_ID: &str = "orchestrator";
/// Fan-out recipient: deliver to every roster member except the sender.
pub const BROADCAST_RECIPIENT: &str = "broadcast";

/// A reply is only obligatory past this many forwards; beyond it the
/// orchestrator must adjudicate instead of letting two agents ping-pong.
pub const MAX_HOPS: u32 = 8;
/// Largest accepted message body (chars). The mailbox is a control plane,
/// not a file transfer; large payloads belong in the worktree.
pub const MAX_BODY_CHARS: usize = 64 * 1024;

static MESSAGE_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum HiveAct {
    Request,
    Inform,
    Propose,
    Query,
    Agree,
    Refuse,
    Done,
}

/// Only request/query/propose obligate a reply. Pure inform/done/agree/refuse
/// are terminal — re-seeing them must never trigger another turn.
pub fn requires_reply(act: HiveAct) -> bool {
    matches!(act, HiveAct::Request | HiveAct::Query | HiveAct::Propose)
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HiveMessage {
    pub id: String,
    pub conversation: String,
    pub in_reply_to: Option<String>,
    pub from: String,
    pub to: String,
    pub act: HiveAct,
    pub subject: String,
    pub body: String,
    pub hops: u32,
    pub requires_reply: bool,
    pub needs_human: bool,
    pub created_at: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MailCursor {
    pub last_processed: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MailUnread {
    pub unread_ids: Vec<String>,
    pub total: u32,
    pub last_processed: Option<String>,
}

/// Every id that may send or receive mail on a run: manifest agents plus the
/// reserved Boss orchestrator.
pub fn roster(manifest: &OrchestrationManifest) -> Vec<String> {
    let mut ids = manifest
        .agents
        .iter()
        .map(|agent| agent.id.clone())
        .collect::<Vec<_>>();
    ids.push(ORCHESTRATOR_ID.to_string());
    ids
}

pub fn validate_new_message(
    manifest: &OrchestrationManifest,
    from: &str,
    to: &str,
    subject: &str,
    body: &str,
    hops: u32,
) -> Result<(), String> {
    let members = roster(manifest);
    if !members.iter().any(|id| id == from) {
        return Err(format!("Unknown mail sender '{from}'"));
    }
    if to != BROADCAST_RECIPIENT && !members.iter().any(|id| id == to) {
        return Err(format!("Unknown mail recipient '{to}'"));
    }
    if from == to {
        return Err("Mail sender and recipient must differ".to_string());
    }
    if subject.trim().is_empty() {
        return Err("Mail subject is required".to_string());
    }
    if body.trim().is_empty() {
        return Err("Mail body is required".to_string());
    }
    if body.chars().count() > MAX_BODY_CHARS {
        return Err(format!("Mail body exceeds {MAX_BODY_CHARS} characters"));
    }
    if hops > MAX_HOPS {
        return Err(format!("Mail exceeds the {MAX_HOPS}-hop forwarding cap"));
    }
    Ok(())
}

/// Time-sortable unique id: zero-padded millis plus a process-wide counter so
/// two messages in the same millisecond never collide.
pub fn next_message_id(created_at_ms: i64, counter: u64) -> String {
    format!("{created_at_ms:013}-{counter:06}")
}

pub fn new_message_id(created_at_ms: i64) -> String {
    let counter = MESSAGE_COUNTER.fetch_add(1, Ordering::Relaxed);
    next_message_id(created_at_ms, counter)
}

/// Mailbox root for a run. Lives under the app home dir — deliberately outside
/// any git working copy, so concurrent agents can never corrupt an index.lock.
pub fn mailbox_root(run_id: &str) -> Result<PathBuf, String> {
    Ok(run_mail_dir(run_id)?.join("agents"))
}

/// The run's own coordination dir (parent of `agents/`): holds the shared
/// PROTOCOL.md. Same location guarantee as [`mailbox_root`].
pub(crate) fn run_mail_dir(run_id: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Cannot resolve the home directory for orchestration mail".to_string())?;
    Ok(home
        .join(".cmdspace")
        .join("orchestration")
        .join(safe_segment(run_id, "run")))
}

pub fn agent_dir(root: &Path, agent_id: &str) -> PathBuf {
    root.join(safe_segment(agent_id, "agent"))
}

pub fn inbox_dir(root: &Path, agent_id: &str) -> PathBuf {
    agent_dir(root, agent_id).join("inbox")
}

pub fn outbox_dir(root: &Path, agent_id: &str) -> PathBuf {
    agent_dir(root, agent_id).join("outbox")
}

pub fn done_dir(root: &Path, agent_id: &str) -> PathBuf {
    inbox_dir(root, agent_id).join(".done")
}

pub fn cursor_path(root: &Path, agent_id: &str) -> PathBuf {
    agent_dir(root, agent_id).join("cursor.json")
}

pub(crate) fn message_filename(id: &str) -> String {
    format!("{}.json", safe_segment(id, "message"))
}

/// Single-writer rule: an agent only ever writes its own outbox. Delivery into
/// another agent's inbox happens exclusively through the router.
pub fn write_outbox(root: &Path, from: &str, message: &HiveMessage) -> Result<(), String> {
    let dir = outbox_dir(root, from);
    fs::create_dir_all(&dir).map_err(|error| format!("Cannot create outbox: {error}"))?;
    let payload = serde_json::to_string_pretty(message)
        .map_err(|error| format!("Cannot serialize mail: {error}"))?;
    atomic_write(&dir.join(message_filename(&message.id)), payload.as_bytes())
}

/// Temp-file + rename in the same directory: readers never observe a partial
/// message, even with many concurrent writers.
pub(crate) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, bytes).map_err(|error| format!("Cannot stage mail file: {error}"))?;
    fs::rename(&tmp, path).map_err(|error| format!("Cannot commit mail file: {error}"))?;
    Ok(())
}

/// Read every `*.json` message in a directory, oldest first. Malformed files
/// are skipped — a concurrent rename can briefly expose one — never fatal.
pub fn read_message_dir(dir: &Path) -> Vec<HiveMessage> {
    let mut entries = fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    entries.sort();
    entries
        .iter()
        .filter_map(|path| fs::read_to_string(path).ok())
        .filter_map(|text| serde_json::from_str::<HiveMessage>(&text).ok())
        .collect()
}

/// Find a message by id across every member's inbox, archive, and outbox.
/// Reply chains resolve through this: the sender names a parent, the backend
/// derives hops and conversation from the found message. Unknown ids resolve
/// to nothing — the caller decides whether that is an error.
pub fn find_message(root: &Path, roster: &[String], id: &str) -> Option<HiveMessage> {
    let filename = message_filename(id);
    for member in roster {
        for dir in [
            inbox_dir(root, member),
            done_dir(root, member),
            outbox_dir(root, member),
        ] {
            if let Ok(text) = fs::read_to_string(dir.join(&filename)) {
                if let Ok(message) = serde_json::from_str::<HiveMessage>(&text) {
                    return Some(message);
                }
            }
        }
    }
    None
}

pub fn load_cursor(root: &Path, agent_id: &str) -> MailCursor {
    fs::read_to_string(cursor_path(root, agent_id))
        .ok()
        .and_then(|text| serde_json::from_str::<MailCursor>(&text).ok())
        .unwrap_or(MailCursor {
            last_processed: None,
        })
}

/// Reader position made load-bearing: ids currently awaiting handling plus
/// the last ack marker. Inbox membership IS the unread set (acked mail moves
/// to `.done/`); the cursor names the most recent ack for badges and wake
/// facts. Delivery dedup stays single-sourced on the `.done/` scan.
pub fn unread_ids(root: &Path, agent_id: &str) -> (Vec<String>, Option<String>) {
    let mut ids = read_message_dir(&inbox_dir(root, agent_id))
        .into_iter()
        .map(|message| message.id)
        .collect::<Vec<_>>();
    ids.sort();
    (ids, load_cursor(root, agent_id).last_processed)
}

fn save_cursor(root: &Path, agent_id: &str, cursor: &MailCursor) -> Result<(), String> {
    let dir = agent_dir(root, agent_id);
    fs::create_dir_all(&dir).map_err(|error| format!("Cannot create agent dir: {error}"))?;
    let payload = serde_json::to_string_pretty(cursor)
        .map_err(|error| format!("Cannot serialize cursor: {error}"))?;
    atomic_write(&cursor_path(root, agent_id), payload.as_bytes())
}

/// Mark a message handled: move it to `inbox/.done/` (kept for audit, never
/// deleted) and advance the cursor so a re-delivery is a no-op.
pub fn acknowledge(root: &Path, agent_id: &str, message_id: &str) -> Result<(), String> {
    let source = inbox_dir(root, agent_id).join(message_filename(message_id));
    if !source.exists() {
        return Err(format!("Unknown inbox message '{message_id}'"));
    }
    let done = done_dir(root, agent_id);
    fs::create_dir_all(&done).map_err(|error| format!("Cannot create done dir: {error}"))?;
    fs::rename(&source, done.join(message_filename(message_id)))
        .map_err(|error| format!("Cannot archive mail: {error}"))?;
    save_cursor(
        root,
        agent_id,
        &MailCursor {
            last_processed: Some(message_id.to_string()),
        },
    )
}

pub fn safe_segment(value: &str, fallback: &str) -> String {
    let result = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    let trimmed = result.trim_matches('-');
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.chars().take(64).collect()
    }
}

/// Unique temp dir for tests. Nanos alone collide across parallel test
/// threads on coarse clocks; pid + sequence makes every dir unique.
#[cfg(test)]
pub(crate) fn temp_test_dir(prefix: &str) -> std::path::PathBuf {
    static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let n = SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let root = std::env::temp_dir().join(format!(
        "{prefix}-{}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default(),
        n
    ));
    let _ = std::fs::remove_dir_all(&root);
    root
}

#[cfg(test)]
mod tests {
    use super::{
        acknowledge, cursor_path, done_dir, find_message, inbox_dir, load_cursor, mailbox_root,
        new_message_id, next_message_id, outbox_dir, read_message_dir, requires_reply, roster,
        safe_segment, unread_ids, validate_new_message, write_outbox, HiveAct, HiveMessage,
        MailCursor, BROADCAST_RECIPIENT, MAX_HOPS, ORCHESTRATOR_ID,
    };
    use crate::modules::orchestration::{
        AgentSpec, OrchestrationManifest, OrchestratorSpec, TaskSpec,
    };
    use std::fs;

    fn manifest() -> OrchestrationManifest {
        OrchestrationManifest {
            version: 1,
            title: "Mail test".to_string(),
            goal: "Route mail".to_string(),
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
                id: "build-1".to_string(),
                title: "build-1".to_string(),
                instructions: "Build".to_string(),
                assignee_id: "builder".to_string(),
                depends_on: vec![],
                write_access: true,
                done_when: "Done".to_string(),
                validation_commands: vec![],
            }],
        }
    }

    fn message(id: &str, from: &str, to: &str) -> HiveMessage {
        HiveMessage {
            id: id.to_string(),
            conversation: "conv-1".to_string(),
            in_reply_to: None,
            from: from.to_string(),
            to: to.to_string(),
            act: HiveAct::Request,
            subject: "Help".to_string(),
            body: "Please review".to_string(),
            hops: 0,
            requires_reply: true,
            needs_human: false,
            created_at: 1_756_000_000_000,
        }
    }

    #[test]
    fn roster_contains_manifest_agents_and_the_reserved_orchestrator() {
        assert_eq!(roster(&manifest()), vec!["builder", ORCHESTRATOR_ID]);
    }

    #[test]
    fn only_request_query_and_propose_obligate_a_reply() {
        assert!(requires_reply(HiveAct::Request));
        assert!(requires_reply(HiveAct::Query));
        assert!(requires_reply(HiveAct::Propose));
        assert!(!requires_reply(HiveAct::Inform));
        assert!(!requires_reply(HiveAct::Done));
        assert!(!requires_reply(HiveAct::Agree));
        assert!(!requires_reply(HiveAct::Refuse));
    }

    #[test]
    fn validation_rejects_unknown_parties_self_send_and_empty_payloads() {
        let manifest = manifest();
        assert!(validate_new_message(&manifest, "builder", ORCHESTRATOR_ID, "s", "b", 0).is_ok());
        assert!(
            validate_new_message(&manifest, "builder", BROADCAST_RECIPIENT, "s", "b", 0).is_ok()
        );
        assert!(validate_new_message(&manifest, "ghost", "builder", "s", "b", 0).is_err());
        assert!(validate_new_message(&manifest, "builder", "ghost", "s", "b", 0).is_err());
        assert!(validate_new_message(&manifest, "builder", "builder", "s", "b", 0).is_err());
        assert!(validate_new_message(&manifest, "builder", ORCHESTRATOR_ID, " ", "b", 0).is_err());
        assert!(validate_new_message(&manifest, "builder", ORCHESTRATOR_ID, "s", " ", 0).is_err());
        assert!(validate_new_message(
            &manifest,
            "builder",
            ORCHESTRATOR_ID,
            "s",
            "b",
            MAX_HOPS + 1
        )
        .is_err());
    }

    #[test]
    fn message_ids_sort_chronologically() {
        assert!(next_message_id(100, 0) < next_message_id(101, 0));
        assert!(next_message_id(100, 0) < next_message_id(100, 1));
        let _ = new_message_id(100);
    }

    #[test]
    fn path_segments_neutralize_traversal() {
        assert_eq!(safe_segment("../../etc", "agent"), "etc");
        assert_eq!(safe_segment("a/b\\c", "agent"), "a-b-c");
        let root = mailbox_root("../evil").expect("root");
        assert!(!root.to_string_lossy().contains(".."));
    }

    #[test]
    fn outbox_round_trips_and_ack_archives_with_cursor() {
        let root = super::temp_test_dir("cmdspace-mail-test");
        let _ = fs::remove_dir_all(&root);
        write_outbox(
            &root,
            "builder",
            &message("m-1", "builder", ORCHESTRATOR_ID),
        )
        .expect("write");
        let pending = read_message_dir(&outbox_dir(&root, "builder"));
        assert_eq!(pending.len(), 1);

        fs::create_dir_all(inbox_dir(&root, ORCHESTRATOR_ID)).expect("inbox");
        fs::rename(
            outbox_dir(&root, "builder").join("m-1.json"),
            inbox_dir(&root, ORCHESTRATOR_ID).join("m-1.json"),
        )
        .expect("deliver");
        acknowledge(&root, ORCHESTRATOR_ID, "m-1").expect("ack");
        assert!(read_message_dir(&inbox_dir(&root, ORCHESTRATOR_ID)).is_empty());
        assert_eq!(read_message_dir(&done_dir(&root, ORCHESTRATOR_ID)).len(), 1);
        let cursor = fs::read_to_string(cursor_path(&root, ORCHESTRATOR_ID)).expect("cursor");
        let cursor = serde_json::from_str::<MailCursor>(&cursor).expect("cursor parses");
        assert_eq!(cursor.last_processed.as_deref(), Some("m-1"));
        assert!(acknowledge(&root, ORCHESTRATOR_ID, "missing").is_err());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn find_message_resolves_across_inbox_archive_and_outbox() {
        let root = super::temp_test_dir("cmdspace-mail-find");
        let _ = fs::remove_dir_all(&root);
        let members = vec!["builder".to_string(), ORCHESTRATOR_ID.to_string()];
        assert!(find_message(&root, &members, "nope").is_none());
        write_outbox(
            &root,
            "builder",
            &message("m-1", "builder", ORCHESTRATOR_ID),
        )
        .expect("write");
        assert_eq!(
            find_message(&root, &members, "m-1").map(|found| found.subject),
            Some("Help".to_string())
        );
        fs::create_dir_all(inbox_dir(&root, ORCHESTRATOR_ID)).expect("inbox");
        fs::rename(
            outbox_dir(&root, "builder").join("m-1.json"),
            inbox_dir(&root, ORCHESTRATOR_ID).join("m-1.json"),
        )
        .expect("deliver");
        assert!(find_message(&root, &members, "m-1").is_some());
        acknowledge(&root, ORCHESTRATOR_ID, "m-1").expect("ack");
        assert!(find_message(&root, &members, "m-1").is_some());
        // Traversal-flavored ids sanitize to the same filename — no escape,
        // at most an alias of a real message.
        assert_eq!(
            find_message(&root, &members, "../m-1").map(|found| found.id),
            Some("m-1".to_string())
        );
        assert!(find_message(&root, &members, "../../etc/passwd").is_none());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn unread_lists_inbox_and_cursor_names_last_ack() {
        let root = super::temp_test_dir("cmdspace-mail-unread");
        let _ = fs::remove_dir_all(&root);
        assert_eq!(load_cursor(&root, "builder").last_processed, None);
        fs::create_dir_all(inbox_dir(&root, ORCHESTRATOR_ID)).expect("inbox");
        for id in ["m-1", "m-2"] {
            write_outbox(&root, "builder", &message(id, "builder", ORCHESTRATOR_ID))
                .expect("write");
            fs::rename(
                outbox_dir(&root, "builder").join(format!("{id}.json")),
                inbox_dir(&root, ORCHESTRATOR_ID).join(format!("{id}.json")),
            )
            .expect("deliver");
        }
        let (unread, last) = unread_ids(&root, ORCHESTRATOR_ID);
        assert_eq!(unread, vec!["m-1", "m-2"]);
        assert_eq!(last, None);
        acknowledge(&root, ORCHESTRATOR_ID, "m-1").expect("ack");
        let (unread, last) = unread_ids(&root, ORCHESTRATOR_ID);
        assert_eq!(unread, vec!["m-2"]);
        assert_eq!(last.as_deref(), Some("m-1"));
        assert_eq!(
            load_cursor(&root, ORCHESTRATOR_ID)
                .last_processed
                .as_deref(),
            Some("m-1")
        );
        let _ = fs::remove_dir_all(&root);
    }
}
