use super::model::{OrchestrationManifest, OrchestrationTaskStatus, TaskExecution, TaskSpec};
use std::collections::{HashMap, HashSet};

pub(crate) const SUPPORTED_MANIFEST_VERSION: u32 = 1;

pub(crate) fn validate_manifest(manifest: &OrchestrationManifest) -> Result<(), Vec<String>> {
    let mut errors = Vec::new();
    if manifest.version != SUPPORTED_MANIFEST_VERSION {
        errors.push(format!(
            "Unsupported orchestration manifest version '{}'",
            manifest.version
        ));
    }
    if manifest.title.trim().is_empty() {
        errors.push("Orchestration title is required".to_string());
    }
    if manifest.goal.trim().is_empty() {
        errors.push("Orchestration goal is required".to_string());
    }
    let mut agent_ids = HashSet::new();
    for agent in &manifest.agents {
        if !agent_ids.insert(agent.id.as_str()) {
            errors.push(format!("Duplicate agent id '{}'", agent.id));
        }
    }
    let mut task_ids = HashSet::new();
    for task in &manifest.tasks {
        if !task_ids.insert(task.id.as_str()) {
            errors.push(format!("Duplicate task id '{}'", task.id));
        }
    }
    for task in &manifest.tasks {
        if !agent_ids.contains(task.assignee_id.as_str()) {
            errors.push(format!(
                "Task '{}' references missing assignee '{}'",
                task.id, task.assignee_id
            ));
        }
        for dependency in &task.depends_on {
            if dependency == &task.id {
                errors.push(format!("Task '{}' cannot depend on itself", task.id));
            } else if !task_ids.contains(dependency.as_str()) {
                errors.push(format!(
                    "Task '{}' references missing dependency '{}'",
                    task.id, dependency
                ));
            }
        }
        if task
            .validation_commands
            .iter()
            .any(|command| command.trim().is_empty())
        {
            errors.push(format!(
                "Task '{}' contains an empty validation command",
                task.id
            ));
        }
    }
    if has_dependency_cycle(&manifest.tasks) {
        errors.push("Task graph contains a dependency cycle".to_string());
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

fn has_dependency_cycle(tasks: &[TaskSpec]) -> bool {
    fn visit<'a>(
        id: &'a str,
        deps: &HashMap<&'a str, &'a [String]>,
        visiting: &mut HashSet<&'a str>,
        visited: &mut HashSet<&'a str>,
    ) -> bool {
        if visiting.contains(id) {
            return true;
        }
        if visited.contains(id) {
            return false;
        }
        visiting.insert(id);
        if let Some(items) = deps.get(id) {
            for dependency in *items {
                if deps.contains_key(dependency.as_str())
                    && visit(dependency, deps, visiting, visited)
                {
                    return true;
                }
            }
        }
        visiting.remove(id);
        visited.insert(id);
        false
    }
    let deps = tasks
        .iter()
        .map(|task| (task.id.as_str(), task.depends_on.as_slice()))
        .collect::<HashMap<_, _>>();
    let mut visiting = HashSet::new();
    let mut visited = HashSet::new();
    tasks
        .iter()
        .any(|task| visit(&task.id, &deps, &mut visiting, &mut visited))
}

pub(crate) fn draft_task_executions(manifest: &OrchestrationManifest) -> Vec<TaskExecution> {
    manifest
        .tasks
        .iter()
        .map(|task| TaskExecution {
            task_id: task.id.clone(),
            status: OrchestrationTaskStatus::Draft,
            attempt: 0,
            result: None,
            chat_id: None,
            runtime_session_id: None,
            branch_name: None,
            worktree_path: None,
        })
        .collect()
}

impl OrchestrationManifest {
    pub fn validate(&self) -> Result<(), Vec<String>> {
        validate_manifest(self)
    }
}
