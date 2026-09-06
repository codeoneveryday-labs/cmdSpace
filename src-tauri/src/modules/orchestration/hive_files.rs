//! Per-run hive bundle: the agent-readable file view of an orchestration run.
//!
//! Follows munder-difflin's hive layout (PROTOCOL.md, registry.json, board.md,
//! tasks.json, `agents/<id>/{identity.md,memory.md,inbox/,outbox/}`). The Rust
//! runtime + SQLite remain the only writers of run state; these files are a
//! read view so plain CLI workers without Tauri access can see the roster, the
//! plan, and live task states. The one exception is `memory.md`: created once,
//! appended by the owning agent, never rewritten by sync.

use super::{mailbox, protocol, OrchestrationRun};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const PROTOCOL_MD: &str = r#"# Hive protocol — cmdSpace Canvas orchestration

You are a worker in an approved orchestration. Coordinate through files:

1. Read `agents/<your-id>/identity.md` (who you are) and `agents/<your-id>/memory.md`
   (what you learned). Append durable lessons to `memory.md` as you work.
2. Read `registry.json` (the team), `board.md` (the shared plan), `tasks.json`
   (live task states). `registry.json` and `tasks.json` are a read view —
   never edit them. `board.md` has one auto-rendered block (between
   `cmdspace:board:auto` markers — never touch it) plus freeform space above
   it where any agent may write durable notes.
3. Check `agents/<your-id>/inbox/` for mail before starting and after finishing
   each step. Processed mail moves to `inbox/.done/` (the coordinator archives
   it when you acknowledge; never delete files).
4. To message another agent, write ONE json file into YOUR OWN
   `agents/<your-id>/outbox/` only — never write into another agent's directory:
   `<unique-id>.json` with shape:
   {"id":"<same as filename>","conversation":"<thread or new id>",
   "in_reply_to":null,"from":"<your-id>","to":"<agent-id>|orchestrator|broadcast",
   "act":"request|inform|propose|query|agree|refuse|done",
   "subject":"short summary","body":"free text, 64 KiB max","hops":0,
   "requires_reply":true for request|query|propose else false,
   "needs_human":false,"created_at":<unix millis>}
   Use a unique id, e.g. `$(date +%s%3N)-$$`. Delivery into inboxes is automatic
   on the next inbox read — no git, no extra calls.
5. Report progress by `inform` mail to `orchestrator`; report completion with a
   `done` mail containing your concise outcome. Only `request|query|propose`
   obligate a reply; `inform|done` are terminal — never ping-pong.
6. To ask for an ad-hoc helper (outside any task), write ONE json file into
   `spawn-requests/<unique-id>.json`:
   {"objective":"concrete goal","cwd":"<repo, optional>",
   "name":"<short name, optional>","command":"<shell command, optional>",
   "provider":"<cli id, optional>","model":"<optional>"}
   The Canvas spawns a terminal for it and archives the file to
   `spawn-requests/.done/`. Reuse an existing agent before spawning.
7. NEVER run git inside the hive dir. NEVER edit another agent's files.
"#;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RegistryEntry {
    id: String,
    name: String,
    role: String,
    provider: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskLedgerEntry {
    id: String,
    title: String,
    assignee: String,
    status: String,
    result: Option<String>,
    worktree: Option<String>,
    branch: Option<String>,
}

/// Markers delimiting the bundle-rendered block inside `board.md`.
/// Everything outside them is agent-owned freeform and survives every sync.
const BOARD_AUTO_START: &str = "<!-- cmdspace:board:auto:start -->";
const BOARD_AUTO_END: &str = "<!-- cmdspace:board:auto:end -->";
const MAX_BOARD_NOTE_CHARS: usize = 4096;

/// Hive root for a run: the parent of the mailbox `agents/` dir.
pub(crate) fn hive_root(run_id: &str) -> Result<PathBuf, String> {
    mailbox::mailbox_root(run_id)?
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Cannot resolve hive root".to_string())
}

/// Best-effort sync: file output must never fail a run transition.
pub(crate) fn sync_run_files(run: &OrchestrationRun) {
    let result = hive_root(&run.id).and_then(|root| write_bundle(&root, run));
    if let Err(error) = result {
        eprintln!("orchestration hive sync failed: {error}");
    }
}

fn write_bundle(root: &Path, run: &OrchestrationRun) -> Result<(), String> {
    if root.as_os_str().is_empty() {
        return Err("Cannot resolve hive root".to_string());
    }
    fs::create_dir_all(root).map_err(|error| format!("Cannot create hive root: {error}"))?;
    atomic_write(&root.join("PROTOCOL.md"), PROTOCOL_MD.as_bytes())?;

    let mut registry: Vec<RegistryEntry> = run
        .manifest
        .agents
        .iter()
        .map(|agent| RegistryEntry {
            id: agent.id.clone(),
            name: agent.name.clone(),
            role: agent.role.clone(),
            provider: agent.provider.clone(),
        })
        .collect();
    registry.push(RegistryEntry {
        id: mailbox::ORCHESTRATOR_ID.to_string(),
        name: "Boss".to_string(),
        role: "Orchestrator".to_string(),
        provider: run.manifest.orchestrator.provider.clone(),
    });
    atomic_write(
        &root.join("registry.json"),
        serde_json::to_string_pretty(&registry)
            .map_err(|error| format!("Cannot serialize registry: {error}"))?
            .as_bytes(),
    )?;

    let ledger = task_ledger(run);
    atomic_write(
        &root.join("tasks.json"),
        serde_json::to_string_pretty(&ledger)
            .map_err(|error| format!("Cannot serialize tasks: {error}"))?
            .as_bytes(),
    )?;

    let auto = render_auto_board(run, &ledger);
    let board = merge_board(
        fs::read_to_string(root.join("board.md")).ok().as_deref(),
        &auto,
    );
    atomic_write(&root.join("board.md"), board.as_bytes())?;

    for member in mailbox::roster(&run.manifest) {
        let agents_dir = root.join("agents");
        let dir = mailbox::agent_dir(&agents_dir, &member);
        fs::create_dir_all(&dir).map_err(|error| format!("Cannot create agent dir: {error}"))?;
        // Single identity renderer (protocol.rs): assignment, worktree, and
        // absolute mailbox paths. Overwritten every sync so it tracks live
        // task state; memory.md below is the only agent-owned file.
        atomic_write(
            &dir.join("identity.md"),
            protocol::render_identity(run, &member, &agents_dir)
                .map_err(|error| format!("Cannot render identity: {error}"))?
                .as_bytes(),
        )?;
        let memory = dir.join("memory.md");
        if !memory.exists() {
            atomic_write(
                &memory,
                format!("# Memory — {member}\n\nAppend durable lessons here.\n").as_bytes(),
            )?;
        }
    }
    Ok(())
}

fn task_ledger(run: &OrchestrationRun) -> Vec<TaskLedgerEntry> {
    run.manifest
        .tasks
        .iter()
        .map(|spec| {
            let execution = run.tasks.iter().find(|task| task.task_id == spec.id);
            TaskLedgerEntry {
                id: spec.id.clone(),
                title: spec.title.clone(),
                assignee: spec.assignee_id.clone(),
                status: execution
                    .map(|task| format!("{:?}", task.status).to_lowercase())
                    .unwrap_or_else(|| "draft".to_string()),
                result: execution.and_then(|task| task.result.clone()),
                worktree: execution.and_then(|task| task.worktree_path.clone()),
                branch: execution.and_then(|task| task.branch_name.clone()),
            }
        })
        .collect()
}

fn render_auto_board(run: &OrchestrationRun, ledger: &[TaskLedgerEntry]) -> String {
    let mut board = format!(
        "{BOARD_AUTO_START}\n# {}\n\nGoal: {}\n\nRun status: {:?}\n",
        run.manifest.title, run.manifest.goal, run.status
    );
    if let Some(branch) = &run.integration_branch {
        board.push_str(&format!("Integration branch: {branch}\n"));
    }
    board.push_str("\n## Tasks (auto)\n");
    for entry in ledger {
        let mark = if entry.status == "completed" {
            "x"
        } else {
            " "
        };
        board.push_str(&format!(
            "- [{mark}] {} ({}, {})\n",
            entry.title, entry.assignee, entry.status
        ));
    }
    board.push_str(BOARD_AUTO_END);
    board
}

/// Merge agent freeform with the fresh auto block. Existing files without
/// markers (hand-written wholesale) are treated as entirely freeform, so no
/// agent prose is ever lost; the auto block is always regenerated.
fn merge_board(existing: Option<&str>, auto: &str) -> String {
    let freeform = split_freeform(existing);
    if freeform.is_empty() {
        auto.to_string()
    } else {
        format!("{freeform}\n\n{auto}")
    }
}

fn split_freeform(existing: Option<&str>) -> String {
    let Some(text) = existing else {
        return String::new();
    };
    match (text.find(BOARD_AUTO_START), text.find(BOARD_AUTO_END)) {
        (Some(start), Some(end)) if end > start => {
            let head = text[..start].trim();
            let tail = text[end + BOARD_AUTO_END.len()..].trim();
            [head, tail]
                .into_iter()
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join("\n\n")
        }
        _ => text.trim().to_string(),
    }
}

fn sanitize_board_note(text: &str) -> String {
    text.replace(BOARD_AUTO_START, "[auto]")
        .replace(BOARD_AUTO_END, "[/auto]")
}

/// Append an attributed note to the freeform section. Marker sequences in
/// the note are neutralized so a note can never corrupt the merge.
pub(crate) fn append_board_note(
    run: &OrchestrationRun,
    agent_id: &str,
    text: &str,
) -> Result<String, String> {
    let root = hive_root(&run.id)?;
    append_board_note_at(run, &root, agent_id, text)
}

fn append_board_note_at(
    run: &OrchestrationRun,
    root: &Path,
    agent_id: &str,
    text: &str,
) -> Result<String, String> {
    let text = sanitize_board_note(text.trim());
    if text.is_empty() {
        return Err("Board note is required".to_string());
    }
    if text.chars().count() > MAX_BOARD_NOTE_CHARS {
        return Err(format!(
            "Board note exceeds {MAX_BOARD_NOTE_CHARS} characters"
        ));
    }
    let path = root.join("board.md");
    let existing = fs::read_to_string(&path).ok();
    let ledger = task_ledger(run);
    let auto = render_auto_board(run, &ledger);
    let freeform = split_freeform(existing.as_deref());
    let note = format!("- [{agent_id}] {text}");
    let merged = if freeform.is_empty() {
        format!("{note}\n\n{auto}")
    } else {
        format!("{freeform}\n{note}\n\n{auto}")
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Cannot create hive root: {error}"))?;
    }
    atomic_write(&path, merged.as_bytes())?;
    Ok(merged)
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, bytes).map_err(|error| format!("Cannot stage hive file: {error}"))?;
    fs::rename(&tmp, path).map_err(|error| format!("Cannot commit hive file: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{append_board_note_at, hive_root, write_bundle};
    use crate::modules::orchestration::{
        AgentSpec, OrchestrationManifest, OrchestratorSpec, TaskExecution, TaskSpec,
    };
    use std::fs;

    fn run() -> crate::modules::orchestration::OrchestrationRun {
        let manifest = OrchestrationManifest {
            version: 1,
            title: "Hive test".to_string(),
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
        };
        let mut run = crate::modules::orchestration::OrchestrationRun::new(
            "run-1",
            "workspace-1",
            "/repo",
            manifest,
        )
        .expect("manifest");
        run.tasks = vec![TaskExecution {
            task_id: "build-1".to_string(),
            status: crate::modules::orchestration::OrchestrationTaskStatus::Running,
            attempt: 1,
            result: None,
            chat_id: None,
            runtime_session_id: None,
            branch_name: None,
            worktree_path: Some("/repo/wt".to_string()),
        }];
        run
    }

    fn temp_root() -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!(
            "cmdspace-hive-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|duration| duration.as_nanos())
                .unwrap_or_default()
        ));
        let _ = fs::remove_dir_all(&root);
        root
    }

    #[test]
    fn bundle_writes_protocol_registry_tasks_board_and_identities() {
        let root = temp_root();
        write_bundle(&root, &run()).expect("bundle");
        assert!(root.join("PROTOCOL.md").exists());
        assert!(root.join("registry.json").exists());
        assert!(root.join("tasks.json").exists());
        assert!(root.join("board.md").exists());
        assert!(root
            .join("agents")
            .join("builder")
            .join("identity.md")
            .exists());
        assert!(root
            .join("agents")
            .join("orchestrator")
            .join("memory.md")
            .exists());

        let tasks = fs::read_to_string(root.join("tasks.json")).expect("tasks");
        assert!(tasks.contains("\"status\": \"running\""));
        assert!(tasks.contains("/repo/wt"));
        let registry = fs::read_to_string(root.join("registry.json")).expect("registry");
        assert!(registry.contains("\"id\": \"builder\""));
        assert!(registry.contains("\"id\": \"orchestrator\""));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn sync_never_clobbers_agent_memory() {
        let root = temp_root();
        write_bundle(&root, &run()).expect("bundle");
        let memory = root.join("agents").join("builder").join("memory.md");
        fs::write(&memory, "# Memory — Builder\n\nLESSON: always run tests.\n").expect("note");
        write_bundle(&root, &run()).expect("resync");
        let contents = fs::read_to_string(&memory).expect("memory");
        assert!(contents.contains("LESSON: always run tests."));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn empty_root_is_rejected() {
        let error = write_bundle(std::path::Path::new(""), &run()).expect_err("empty");
        assert!(error.contains("hive root"));
        let _ = hive_root("run-1");
    }

    #[test]
    fn freeform_survives_resync_while_auto_refreshes() {
        let root = temp_root();
        write_bundle(&root, &run()).expect("bundle");
        let board = root.join("board.md");
        let contents = fs::read_to_string(&board).expect("board");
        fs::write(&board, format!("AGENT NOTE: ship Friday.\n\n{contents}")).expect("annotate");
        write_bundle(&root, &run()).expect("resync");
        let contents = fs::read_to_string(&board).expect("board");
        assert!(contents.contains("AGENT NOTE: ship Friday."));
        assert_eq!(contents.matches("Run status:").count(), 1);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn markerless_files_are_kept_wholesale() {
        let root = temp_root();
        fs::create_dir_all(&root).expect("root");
        fs::write(root.join("board.md"), "Hand-written plan.\n").expect("board");
        write_bundle(&root, &run()).expect("bundle");
        let contents = fs::read_to_string(root.join("board.md")).expect("board");
        assert!(contents.contains("Hand-written plan."));
        assert!(contents.contains("Run status:"));
    }

    #[test]
    fn append_note_lands_in_freeform_and_survives_resync() {
        let root = temp_root();
        write_bundle(&root, &run()).expect("bundle");
        let merged =
            append_board_note_at(&run(), &root, "builder", "Blocked on API keys.").expect("note");
        assert!(merged.contains("- [builder] Blocked on API keys."));
        write_bundle(&root, &run()).expect("resync");
        let contents = fs::read_to_string(root.join("board.md")).expect("board");
        assert!(contents.contains("- [builder] Blocked on API keys."));
        assert!(append_board_note_at(&run(), &root, "builder", "   ").is_err());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn note_markers_are_neutralized() {
        let root = temp_root();
        write_bundle(&root, &run()).expect("bundle");
        let merged = append_board_note_at(
            &run(),
            &root,
            "builder",
            "x <!-- cmdspace:board:auto:start --> y",
        )
        .expect("note");
        assert!(!merged.contains("<!-- cmdspace:board:auto:start --> y"));
        assert!(merged.contains("[auto]"));
        let _ = fs::remove_dir_all(&root);
    }
}
