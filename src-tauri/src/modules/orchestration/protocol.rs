use super::mailbox::{self, BROADCAST_RECIPIENT, ORCHESTRATOR_ID};
use super::OrchestrationRun;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// File a CLI worker reads at task start to become hive-aware: who it is,
/// what it owns, and the exact mailbox paths to read and write. Overwritten
/// on every ensure/sync so the shipped text always tracks current code.
/// The shared `PROTOCOL.md` beside it is owned by the hive bundle
/// (`hive_files.rs`); this module renders identities only.
pub const IDENTITY_FILENAME: &str = "identity.md";

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentIdentity {
    pub agent_id: String,
    pub identity_path: String,
    pub identity: String,
}

pub fn identity_path(run_id: &str, agent_id: &str) -> Result<std::path::PathBuf, String> {
    let root = mailbox::mailbox_root(run_id)?;
    Ok(mailbox::agent_dir(&root, agent_id).join(IDENTITY_FILENAME))
}

/// Render one agent's identity. Workers get their assignment; the reserved
/// orchestrator id gets the roster, the traffic policy, and the dispatch
/// contract pointer instead.
pub fn render_identity(
    run: &OrchestrationRun,
    agent_id: &str,
    root: &Path,
) -> Result<String, String> {
    // The shared PROTOCOL.md lives beside the `agents/` dir (owned by the
    // hive bundle); derive from the passed root so temp roots work too.
    let protocol = root
        .parent()
        .map(|parent| parent.join("PROTOCOL.md").to_string_lossy().into_owned())
        .unwrap_or_else(|| "PROTOCOL.md".to_string());
    if agent_id == ORCHESTRATOR_ID {
        return Ok(render_orchestrator_identity(run, &protocol));
    }
    let agent = run
        .manifest
        .agents
        .iter()
        .find(|agent| agent.id == agent_id)
        .ok_or_else(|| format!("Unknown mail agent '{agent_id}'"))?;
    let mut tasks = String::new();
    for spec in run
        .manifest
        .tasks
        .iter()
        .filter(|task| task.assignee_id == agent_id)
    {
        let execution = run
            .tasks
            .iter()
            .find(|execution| execution.task_id == spec.id);
        tasks.push_str(&format!(
            "\n### {}\n- Title: {}\n- Instructions: {}\n- Done when: {}\n- Status: {}\n- Worktree: {}\n- Branch: {}\n",
            spec.id,
            spec.title,
            spec.instructions,
            spec.done_when,
            execution
                .map(|execution| format!("{:?}", execution.status))
                .unwrap_or_else(|| "unknown".to_string()),
            execution
                .and_then(|execution| execution.worktree_path.clone())
                .unwrap_or_else(|| run.cwd.clone()),
            execution
                .and_then(|execution| execution.branch_name.clone())
                .unwrap_or_else(|| "-".to_string()),
        ));
    }
    if tasks.is_empty() {
        tasks.push_str("\nNo tasks assigned yet.\n");
    }
    Ok(format!(
        r#"# Agent identity: {name} (`{id}`)

You are an autonomous worker in the approved cmdSpace orchestration
"{run_title}". Overall goal: {goal}

- Role: {role}
- Provider: {provider}{model}
- Run: {run_id} (workspace `{workspace_id}`, repo root `{cwd}`)
- Orchestrator: `{orchestrator}` — address all mail to the orchestrator.

## Assigned tasks
{tasks}
## Mailbox (absolute paths — read and write these directly)

- Inbox: `{inbox}`
- Outbox: `{outbox}`
- Handled archive: `{done}`
- Your memory: `{memory}`
- Shared protocol: `{protocol}`

Follow it every task:

1. At task START, read your `memory.md` (what you learned before) and every
   file in your inbox. After handling a message, move its file into
   `inbox/.done/`.
2. To ask for something or report, write ONE JSON file per message into your
   outbox (schema in PROTOCOL.md). Never write into another agent's folder —
   the router delivers your outbox.
3. Do your assigned work in the task worktree, then report a concise outcome.
4. At task END, append what you learned to `memory.md` so future-you remembers.
"#,
        name = agent.name,
        id = agent.id,
        run_title = run.manifest.title,
        goal = run.manifest.goal,
        role = agent.role,
        provider = agent.provider,
        model = agent
            .model
            .as_ref()
            .map(|model| format!(" (model {model})"))
            .unwrap_or_default(),
        run_id = run.id,
        workspace_id = run.workspace_id,
        cwd = run.cwd,
        orchestrator = ORCHESTRATOR_ID,
        inbox = mailbox::inbox_dir(root, agent_id).to_string_lossy(),
        outbox = mailbox::outbox_dir(root, agent_id).to_string_lossy(),
        done = mailbox::done_dir(root, agent_id).to_string_lossy(),
        memory = mailbox::agent_dir(root, agent_id)
            .join("memory.md")
            .to_string_lossy(),
        protocol = protocol,
        tasks = tasks,
    ))
}

fn render_orchestrator_identity(run: &OrchestrationRun, protocol: &str) -> String {
    let mut roster = String::new();
    for agent in &run.manifest.agents {
        roster.push_str(&format!(
            "- `{}` — {} (role: {}, provider: {}){}\n",
            agent.id,
            agent.name,
            agent.role,
            agent.provider,
            agent
                .model
                .as_ref()
                .map(|model| format!(", model: {model}"))
                .unwrap_or_default(),
        ));
    }
    let mut tasks = String::new();
    for spec in &run.manifest.tasks {
        let status = run
            .tasks
            .iter()
            .find(|execution| execution.task_id == spec.id)
            .map(|execution| format!("{:?}", execution.status))
            .unwrap_or_else(|| "unknown".to_string());
        tasks.push_str(&format!(
            "- `{}` → `{}` [{status}]: {}\n",
            spec.id, spec.assignee_id, spec.title
        ));
    }
    format!(
        r#"# Orchestrator identity

You are the Boss orchestrator of the approved cmdSpace orchestration
"{run_title}". Overall goal: {goal}

Your job is to ORCHESTRATE, not to implement: keep live awareness of every
agent and task, and delegate the work. Answer clarifications so the team runs
autonomously; escalate to the human only what is genuinely critical
(destructive actions, real spend, scope changes, unresolvable conflicts).

- Run: {run_id} (workspace `{workspace_id}`, repo root `{cwd}`)
- Shared protocol: {protocol}
- Live state you can read any time: `registry.json` (the team),
  `tasks.json` (task states, assignees, worktrees), `board.md` (shared plan),
  every agent's `memory.md` (what they learned), plus your own inbox.

## Awareness

Always know what is going on: which agents are active, what each task's
state is (`tasks.json`), and what is waiting in your inbox. Drain your inbox
first, then act. After an app restart, tasks may sit `interrupted` until the
coordinator resumes them — check states before dispatching, never assume a
quiet agent is a free agent.

## Delegate

Decompose work and fan it out through the mailbox; do not do the workers'
jobs. Before routing to someone new, check the roster above and prefer an
EXISTING agent whose role fits — one capable owner beats a duplicate. New
agents only enter through a revised graph proposal the human approves.
When dispatching, use the four-part contract from PROTOCOL.md (objective,
output, tools, boundaries) and pass references (paths, message ids), not
pasted content.

## Roster

{roster}
## Tasks

{tasks}
## Traffic policy

Workers address you; you address anyone (`to` an agent id or `{broadcast}`
for all). Resolve routine traffic yourself. When dispatching, use the
four-part contract from PROTOCOL.md (objective, output, tools, boundaries).
At most three tasks run concurrently and each agent runs at most one task —
the scheduler enforces it, you plan within it.
"#,
        run_title = run.manifest.title,
        goal = run.manifest.goal,
        run_id = run.id,
        workspace_id = run.workspace_id,
        cwd = run.cwd,
        protocol = protocol,
        roster = roster,
        tasks = tasks,
        broadcast = BROADCAST_RECIPIENT,
    )
}

/// Ensure one agent's identity file exists (overwritten every call) and
/// return it with its path.
pub fn ensure_identity(
    run_id: &str,
    agent_id: &str,
    run: &OrchestrationRun,
) -> Result<AgentIdentity, String> {
    let agent_id = agent_id.trim();
    if agent_id != ORCHESTRATOR_ID && !run.manifest.agents.iter().any(|agent| agent.id == agent_id)
    {
        return Err(format!("Unknown mail agent '{agent_id}'"));
    }
    let root = mailbox::mailbox_root(run_id)?;
    let path = identity_path(run_id, agent_id)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Cannot create agent dir: {error}"))?;
    }
    let identity = render_identity(run, agent_id, &root)?;
    mailbox::atomic_write(&path, identity.as_bytes())?;
    Ok(AgentIdentity {
        agent_id: agent_id.to_string(),
        identity_path: path.to_string_lossy().into_owned(),
        identity,
    })
}

#[cfg(test)]
mod tests {
    use super::{ensure_identity, render_identity, IDENTITY_FILENAME};
    use crate::modules::orchestration::mailbox::{self, BROADCAST_RECIPIENT, ORCHESTRATOR_ID};
    use crate::modules::orchestration::{
        AgentSpec, OrchestrationManifest, OrchestratorSpec, TaskSpec,
    };

    fn run() -> crate::modules::orchestration::OrchestrationRun {
        let manifest = OrchestrationManifest {
            version: 1,
            title: "Protocol test".to_string(),
            goal: "Ship it".to_string(),
            orchestrator: OrchestratorSpec {
                provider: "codex".to_string(),
                model: None,
            },
            agents: vec![AgentSpec {
                id: "builder".to_string(),
                name: "Builder".to_string(),
                role: "Implementation".to_string(),
                provider: "claude".to_string(),
                model: Some("opus".to_string()),
            }],
            tasks: vec![TaskSpec {
                id: "build-1".to_string(),
                title: "Build it".to_string(),
                instructions: "Write code".to_string(),
                assignee_id: "builder".to_string(),
                depends_on: vec![],
                write_access: true,
                done_when: "Tests pass".to_string(),
                validation_commands: vec![],
            }],
        };
        crate::modules::orchestration::OrchestrationRun::new("run-1", "ws-1", "/repo", manifest)
            .expect("run")
    }

    #[test]
    fn worker_identity_names_assignment_and_paths() {
        let run = run();
        let root = mailbox::mailbox_root(&run.id).expect("root");
        let text = render_identity(&run, "builder", &root).expect("identity");
        assert!(text.contains("Builder"));
        assert!(text.contains("Write code"));
        assert!(text.contains("Tests pass"));
        assert!(text.contains("opus"));
        assert!(text.contains("outbox"));
        assert!(text.contains("PROTOCOL.md"));
        assert!(text.contains("memory.md"));
        assert!(text.contains("## Assigned tasks"));
        assert!(render_identity(&run, "ghost", &root).is_err());
    }

    #[test]
    fn orchestrator_identity_lists_roster_and_tasks() {
        let run = run();
        let root = mailbox::mailbox_root(&run.id).expect("root");
        let text = render_identity(&run, ORCHESTRATOR_ID, &root).expect("identity");
        assert!(text.contains("ORCHESTRATE, not to implement"));
        assert!(text.contains("## Awareness"));
        assert!(text.contains("## Delegate"));
        assert!(text.contains("registry.json"));
        assert!(text.contains("builder"));
        assert!(text.contains("build-1"));
        assert!(text.contains(BROADCAST_RECIPIENT));
    }

    #[test]
    fn ensure_writes_identity_file() {
        let run = run();
        let run_id = format!(
            "protocol-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|duration| duration.as_nanos())
                .unwrap_or_default()
        );
        let mut run = run;
        run.id = run_id.clone();
        let bundle = ensure_identity(&run_id, "builder", &run).expect("bundle");
        assert!(bundle.identity_path.ends_with(IDENTITY_FILENAME));
        assert_eq!(
            std::fs::read_to_string(&bundle.identity_path).expect("read identity"),
            bundle.identity
        );
        // Re-ensure overwrites and rejects strangers.
        ensure_identity(&run_id, "builder", &run).expect("re-ensure");
        assert!(ensure_identity(&run_id, "ghost", &run).is_err());
        let _ = std::fs::remove_dir_all(
            mailbox::run_mail_dir(&run_id)
                .expect("run dir")
                .to_string_lossy()
                .into_owned(),
        );
    }
}
