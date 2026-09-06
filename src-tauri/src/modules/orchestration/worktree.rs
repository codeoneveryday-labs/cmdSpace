use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::{OrchestrationRun, OrchestrationTaskStatus};
use crate::modules::git::run_git;
use crate::modules::workspace::WorkspaceEnv;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorktreeNames {
    pub branch: String,
    pub path: PathBuf,
}

pub fn worktree_names(root: &Path, repo_name: &str, run_id: &str, task_id: &str) -> WorktreeNames {
    let repo = safe_segment(repo_name, "repo");
    let run = safe_segment(run_id, "run");
    let task = safe_segment(task_id, "task");
    WorktreeNames {
        branch: format!("cmdspace/orch-{run}-{task}"),
        path: root.join(repo).join(run).join(task),
    }
}

fn should_use_task_worktree(write_access: bool) -> bool {
    write_access
}

fn integration_commit_message(task_id: &str) -> String {
    format!("cmdSpace orchestration: integrate {task_id}")
}

pub fn prepare_task_worktree(
    run: &mut OrchestrationRun,
    task_id: &str,
    workspace: &WorkspaceEnv,
) -> Result<(String, PathBuf), String> {
    let task_spec = run
        .manifest
        .tasks
        .iter()
        .find(|task| task.id == task_id)
        .ok_or_else(|| format!("Unknown orchestration task '{task_id}'"))?;
    if !should_use_task_worktree(task_spec.write_access) {
        let workspace_path = run.cwd.clone();
        let task = run.task_mut(task_id).map_err(|error| error.to_string())?;
        task.branch_name = None;
        task.worktree_path = Some(workspace_path.clone());
        return Ok((String::new(), PathBuf::from(workspace_path)));
    }
    if !matches!(workspace, WorkspaceEnv::Local) {
        return Err("Orchestration worktrees are currently local-only".to_string());
    }
    let repo_root = git_text(run, workspace, &["rev-parse", "--show-toplevel"])?;
    let source_commit = git_text(run, workspace, &["rev-parse", "HEAD"])?;
    let repo_name = Path::new(&repo_root)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("repo");
    let worktree_root = dirs::home_dir()
        .ok_or_else(|| "Cannot resolve the home directory for orchestration worktrees".to_string())?
        .join(".cmdspace")
        .join("worktrees");
    let run_segment = safe_segment(&run.id, "run");
    let names = worktree_names(&worktree_root, repo_name, &run.id, task_id);
    let integration_branch = run
        .integration_branch
        .clone()
        .unwrap_or_else(|| format!("cmdspace/orch-{run_segment}"));
    let integration_path = worktree_root
        .join(safe_segment(repo_name, "repo"))
        .join(run_segment)
        .join("integration");

    if run.integration_branch.is_none() {
        let output = run_git(
            workspace,
            Some(&repo_root),
            [
                "worktree",
                "add",
                "-b",
                integration_branch.as_str(),
                integration_path.to_string_lossy().as_ref(),
                source_commit.as_str(),
            ],
            30,
        )
        .map_err(|error| error.to_string())?;
        ensure_git_success(output, "create orchestration integration worktree")?;
        run.source_commit = Some(source_commit);
        run.integration_branch = Some(integration_branch.clone());
        run.integration_worktree = Some(integration_path.to_string_lossy().into_owned());
    }

    let task_path = names.path;
    if !task_path.exists() {
        std::fs::create_dir_all(
            task_path
                .parent()
                .ok_or_else(|| "Invalid orchestration task worktree path".to_string())?,
        )
        .map_err(|error| format!("Failed to create orchestration worktree parent: {error}"))?;
        let output = run_git(
            workspace,
            Some(&repo_root),
            [
                "worktree",
                "add",
                "-b",
                names.branch.as_str(),
                task_path.to_string_lossy().as_ref(),
                integration_branch.as_str(),
            ],
            30,
        )
        .map_err(|error| error.to_string())?;
        ensure_git_success(output, "create orchestration task worktree")?;
    }

    let task = run.task_mut(task_id).map_err(|error| error.to_string())?;
    task.branch_name = Some(names.branch.clone());
    task.worktree_path = Some(task_path.to_string_lossy().into_owned());
    Ok((names.branch, task_path))
}

pub fn integrate_task(run: &mut OrchestrationRun, task_id: &str) -> Result<(), String> {
    let task_spec = run
        .manifest
        .tasks
        .iter()
        .find(|task| task.id == task_id)
        .ok_or_else(|| format!("Unknown orchestration task '{task_id}'"))?;
    if !should_use_task_worktree(task_spec.write_access) {
        return Ok(());
    }

    let task = run
        .tasks
        .iter()
        .find(|task| task.task_id == task_id)
        .ok_or_else(|| format!("Unknown orchestration task '{task_id}'"))?;
    let task_branch = task
        .branch_name
        .as_deref()
        .ok_or_else(|| format!("Task '{task_id}' has no worktree branch"))?;
    let task_worktree = task
        .worktree_path
        .as_deref()
        .ok_or_else(|| format!("Task '{task_id}' has no worktree path"))?;
    let integration_worktree = run
        .integration_worktree
        .as_deref()
        .ok_or_else(|| "Orchestration has no integration worktree".to_string())?;
    let status = run_git(
        &WorkspaceEnv::Local,
        Some(task_worktree),
        ["status", "--porcelain"],
        30,
    )
    .map_err(|error| error.to_string())?;
    let status = ensure_git_success(status, "inspect orchestration task worktree")?;
    if !status.is_empty() {
        let staged = run_git(&WorkspaceEnv::Local, Some(task_worktree), ["add", "-A"], 30)
            .map_err(|error| error.to_string())?;
        ensure_git_success(staged, "stage orchestration task changes")?;

        let message = integration_commit_message(task_id);
        let committed = run_git(
            &WorkspaceEnv::Local,
            Some(task_worktree),
            [
                "-c",
                "user.name=cmdSpace Orchestrator",
                "-c",
                "user.email=orchestration@cmdspace.local",
                "commit",
                "-m",
                message.as_str(),
            ],
            30,
        )
        .map_err(|error| error.to_string())?;
        ensure_git_success(committed, "commit orchestration task changes")?;
    }

    let message = integration_commit_message(task_id);
    let merged = run_git(
        &WorkspaceEnv::Local,
        Some(integration_worktree),
        ["merge", "--no-ff", task_branch, "-m", message.as_str()],
        30,
    )
    .map_err(|error| error.to_string())?;
    if merged.exit_code != Some(0) || merged.timed_out {
        let _ = run_git(
            &WorkspaceEnv::Local,
            Some(integration_worktree),
            ["merge", "--abort"],
            30,
        );
        let stderr = String::from_utf8_lossy(&merged.stderr).trim().to_string();
        return Err(format!(
            "Integration merge conflict for task '{task_id}'{}",
            if stderr.is_empty() {
                String::new()
            } else {
                format!(": {stderr}")
            }
        ));
    }
    Ok(())
}

fn git_text(
    run: &OrchestrationRun,
    workspace: &WorkspaceEnv,
    args: &[&str],
) -> Result<String, String> {
    let output =
        run_git(workspace, Some(&run.cwd), args.iter(), 30).map_err(|error| error.to_string())?;
    ensure_git_success(output, "inspect orchestration Git repository")
}

fn ensure_git_success(
    output: crate::modules::git::GitOutput,
    operation: &str,
) -> Result<String, String> {
    if output.exit_code == Some(0) && !output.timed_out {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(format!(
        "{operation} failed{}",
        if stderr.is_empty() {
            "".to_string()
        } else {
            format!(": {stderr}")
        }
    ))
}

fn safe_segment(value: &str, fallback: &str) -> String {
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
        trimmed.chars().take(48).collect()
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskFinalizeEntry {
    pub task_id: String,
    pub integrated: bool,
    pub preserved: bool,
    pub reason: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunFinalizeReport {
    pub entries: Vec<TaskFinalizeEntry>,
}

/// Finalize a run without deleting anything: completed tasks with worktrees
/// are merged into the integration branch (idempotent — already-merged is a
/// success); everything else is reported preserved with its branch/path so
/// the operator can inspect or retry. Nothing is removed here.
pub fn finalize_run(run: &mut OrchestrationRun) -> RunFinalizeReport {
    let mut entries = Vec::new();
    for task in run.tasks.clone() {
        let entry = match task.status {
            OrchestrationTaskStatus::Completed => {
                let has_worktree = task.branch_name.is_some() && task.worktree_path.is_some();
                if !has_worktree {
                    TaskFinalizeEntry {
                        task_id: task.task_id.clone(),
                        integrated: true,
                        preserved: false,
                        reason: "no worktree — nothing to merge".to_string(),
                    }
                } else {
                    match integrate_task(run, &task.task_id) {
                        Ok(()) => TaskFinalizeEntry {
                            task_id: task.task_id.clone(),
                            integrated: true,
                            preserved: false,
                            reason: "merged into integration branch".to_string(),
                        },
                        Err(error) => TaskFinalizeEntry {
                            task_id: task.task_id.clone(),
                            integrated: false,
                            preserved: true,
                            reason: format!(
                                "merge failed, worktree kept at {}: {error}",
                                task.worktree_path.as_deref().unwrap_or("<unknown>")
                            ),
                        },
                    }
                }
            }
            status => TaskFinalizeEntry {
                task_id: task.task_id.clone(),
                integrated: false,
                preserved: task.worktree_path.is_some(),
                reason: format!("task is {status:?} — worktree left untouched"),
            },
        };
        entries.push(entry);
    }
    RunFinalizeReport { entries }
}

#[cfg(test)]
mod tests {
    use super::{finalize_run, integration_commit_message, should_use_task_worktree};
    use super::{OrchestrationRun, OrchestrationTaskStatus};
    use crate::modules::orchestration::{
        AgentSpec, OrchestrationManifest, OrchestratorSpec, TaskSpec,
    };

    #[test]
    fn writable_tasks_are_integrated_with_a_deterministic_commit_message() {
        assert!(should_use_task_worktree(true));
        assert!(!should_use_task_worktree(false));
        assert_eq!(
            integration_commit_message("task/login"),
            "cmdSpace orchestration: integrate task/login"
        );
    }

    fn finalize_manifest() -> OrchestrationManifest {
        OrchestrationManifest {
            version: 1,
            title: "finalize".to_string(),
            goal: "finalize".to_string(),
            orchestrator: OrchestratorSpec {
                provider: "codex".to_string(),
                model: None,
            },
            agents: vec![AgentSpec {
                id: "builder".to_string(),
                name: "Builder".to_string(),
                role: "Implementation".to_string(),
                provider: "codex".to_string(),
                model: None,
            }],
            tasks: vec![TaskSpec {
                id: "build-1".to_string(),
                title: "build".to_string(),
                instructions: "build".to_string(),
                assignee_id: "builder".to_string(),
                depends_on: vec![],
                write_access: true,
                done_when: "done".to_string(),
                validation_commands: vec![],
            }],
        }
    }

    #[test]
    fn finalize_preserves_without_deleting_anything() {
        let mut run = OrchestrationRun::new("run-1", "ws-1", "/repo", finalize_manifest()).unwrap();
        let task = run
            .tasks
            .iter_mut()
            .find(|task| task.task_id == "build-1")
            .unwrap();
        task.status = OrchestrationTaskStatus::Completed;
        task.branch_name = None;
        task.worktree_path = None;
        let report = finalize_run(&mut run);
        assert_eq!(report.entries.len(), 1);
        assert!(report.entries[0].integrated);
        assert!(!report.entries[0].preserved);

        let task = run
            .tasks
            .iter_mut()
            .find(|task| task.task_id == "build-1")
            .unwrap();
        task.status = OrchestrationTaskStatus::Failed;
        task.branch_name = Some("cmdspace/orch-run-1-build-1".to_string());
        task.worktree_path = Some("/tmp/wt".to_string());
        let report = finalize_run(&mut run);
        assert!(!report.entries[0].integrated);
        assert!(report.entries[0].preserved);
        assert!(report.entries[0].reason.contains("Failed"));
    }
}
