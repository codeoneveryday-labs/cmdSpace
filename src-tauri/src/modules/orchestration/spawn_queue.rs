//! Ephemeral worker spawn requests (munder-difflin `spawn-requests/`).
//!
//! The Boss (or any CLI with shell access) asks for an ad-hoc helper by
//! writing one JSON file per worker into `<run>/spawn-requests/`. The Canvas
//! reconcile loop lists pending requests, spawns a terminal node for each,
//! and claims it (moving the file to `spawn-requests/.done/`). No daemon:
//! claiming is driven entirely by polling readers, and every operation is
//! idempotent.

use super::hive_files::hive_root;
use super::mailbox;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const SPAWN_REQUESTS_DIR: &str = "spawn-requests";
const DONE_DIR: &str = ".done";

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnRequest {
    pub objective: String,
    pub cwd: Option<String>,
    pub name: Option<String>,
    pub command: Option<String>,
    pub provider: Option<String>,
    pub model: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingSpawnRequest {
    pub id: String,
    pub request: SpawnRequest,
}

pub(crate) fn spawn_requests_dir(run_id: &str) -> Result<PathBuf, String> {
    Ok(hive_root(run_id)?.join(SPAWN_REQUESTS_DIR))
}

fn is_valid_request_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
}

fn parse_request_file(path: &Path) -> Option<(String, SpawnRequest)> {
    if path.extension().is_some_and(|ext| ext != "json") {
        return None;
    }
    let id = path.file_stem()?.to_str()?.to_string();
    if !is_valid_request_id(&id) {
        return None;
    }
    let text = fs::read_to_string(path).ok()?;
    let request: SpawnRequest = serde_json::from_str(&text).ok()?;
    if request.objective.trim().is_empty() {
        return None;
    }
    Some((id, request))
}

/// Pending requests, oldest filename first. Malformed files are skipped —
/// a concurrent write can briefly expose one — and left for a human.
pub(crate) fn list_pending_in(dir: &Path) -> Vec<PendingSpawnRequest> {
    let mut paths = fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .filter(|path| path.is_file())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    paths.sort();
    paths
        .iter()
        .filter_map(|path| parse_request_file(path))
        .map(|(id, request)| PendingSpawnRequest { id, request })
        .collect()
}

/// Claim a request by moving it to `.done/`. Fails when the id is invalid,
/// the file is missing, or the payload is malformed — never claims garbage.
pub(crate) fn claim_in(dir: &Path, id: &str) -> Result<PendingSpawnRequest, String> {
    if !is_valid_request_id(id) {
        return Err(format!("Invalid spawn request id '{id}'"));
    }
    let source = dir.join(mailbox::message_filename(id));
    let text = fs::read_to_string(&source).map_err(|_| format!("Unknown spawn request '{id}'"))?;
    let request: SpawnRequest =
        serde_json::from_str(&text).map_err(|_| format!("Malformed spawn request '{id}'"))?;
    if request.objective.trim().is_empty() {
        return Err(format!("Spawn request '{id}' has an empty objective"));
    }
    let done = dir.join(DONE_DIR);
    fs::create_dir_all(&done).map_err(|error| format!("Cannot create done dir: {error}"))?;
    fs::rename(&source, done.join(mailbox::message_filename(id)))
        .map_err(|error| format!("Cannot claim spawn request: {error}"))?;
    Ok(PendingSpawnRequest {
        id: id.to_string(),
        request,
    })
}

pub(crate) fn list_pending(run_id: &str) -> Result<Vec<PendingSpawnRequest>, String> {
    Ok(list_pending_in(&spawn_requests_dir(run_id)?))
}

pub(crate) fn claim(run_id: &str, id: &str) -> Result<PendingSpawnRequest, String> {
    claim_in(&spawn_requests_dir(run_id)?, id.trim())
}

#[cfg(test)]
mod tests {
    use super::{claim_in, is_valid_request_id, list_pending_in};
    use std::fs;

    fn temp_dir() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "cmdspace-spawn-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|duration| duration.as_nanos())
                .unwrap_or_default()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    fn write(dir: &std::path::Path, name: &str, body: &str) {
        fs::write(dir.join(name), body).expect("fixture");
    }

    const VALID: &str = r#"{"objective":"Triage inbox","provider":"aider"}"#;

    #[test]
    fn ids_reject_traversal_and_blanks() {
        assert!(is_valid_request_id("worker-1_a"));
        assert!(!is_valid_request_id(""));
        assert!(!is_valid_request_id("../evil"));
        assert!(!is_valid_request_id("a/b"));
        assert!(!is_valid_request_id("a.json"));
    }

    #[test]
    fn list_skips_malformed_and_empty_objectives() {
        let dir = temp_dir();
        write(&dir, "good.json", VALID);
        write(&dir, "broken.json", "{not json");
        write(&dir, "empty.json", r#"{"objective":"  "}"#);
        write(&dir, "notes.txt", "ignore me");

        let pending = list_pending_in(&dir);
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].id, "good");
        assert_eq!(pending[0].request.provider.as_deref(), Some("aider"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn claim_moves_to_done_and_never_claims_garbage() {
        let dir = temp_dir();
        write(&dir, "helper.json", VALID);
        write(&dir, "broken.json", "{not json");

        let claimed = claim_in(&dir, "helper").expect("claim");
        assert_eq!(claimed.id, "helper");
        assert!(!dir.join("helper.json").exists());
        assert!(dir.join(".done").join("helper.json").exists());

        assert!(claim_in(&dir, "helper").is_err());
        assert!(claim_in(&dir, "broken").is_err());
        assert!(dir.join("broken.json").exists());
        assert!(claim_in(&dir, "../evil").is_err());
        let _ = fs::remove_dir_all(&dir);
    }
}
