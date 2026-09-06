import type { OrchestrationProvider as CanvasOrchestrationProvider } from "@/modules/tabs";
import { CLI_AGENT_IDS } from "@/modules/terminal/lib/cliAgents";

export const ORCHESTRATION_PROVIDERS = CLI_AGENT_IDS;

export type OrchestrationProvider = CanvasOrchestrationProvider;

export type OrchestrationManifestV1 = {
  version: 1;
  title: string;
  goal: string;
  orchestrator: {
    provider: OrchestrationProvider;
    model?: string;
  };
  agents: Array<{
    id: string;
    name: string;
    role: string;
    provider: OrchestrationProvider;
    model?: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    instructions: string;
    assigneeId: string;
    dependsOn: string[];
    writeAccess: boolean;
    doneWhen: string;
    validationCommands: string[];
  }>;
};

export type OrchestrationManifestValidation =
  | { valid: true }
  | { valid: false; errors: string[] };

const supportedProviders = new Set<string>(ORCHESTRATION_PROVIDERS);

export function createOrchestrationDraft(
  goal: string,
  provider: OrchestrationProvider,
): OrchestrationManifestV1 {
  const title = goal.trim() || "Untitled orchestration";
  return {
    version: 1,
    title,
    goal: title,
    orchestrator: { provider },
    agents: [
      {
        id: "builder",
        name: "Builder",
        role: "Implementation",
        provider,
      },
    ],
    tasks: [
      {
        id: "initial-task",
        title: "Initial task",
        instructions: title,
        assigneeId: "builder",
        dependsOn: [],
        writeAccess: true,
        doneWhen: "Summarize the outcome and run the approved validation commands.",
        validationCommands: [],
      },
    ],
  };
}

export function validateOrchestrationManifest(
  manifest: OrchestrationManifestV1,
): OrchestrationManifestValidation {
  const errors: string[] = [];
  const agentIds = new Set<string>();
  const taskIds = new Set<string>();

  for (const agent of manifest.agents) {
    if (agentIds.has(agent.id)) errors.push(`Duplicate agent id '${agent.id}'`);
    else agentIds.add(agent.id);
  }
  for (const task of manifest.tasks) {
    if (taskIds.has(task.id)) errors.push(`Duplicate task id '${task.id}'`);
    else taskIds.add(task.id);
  }

  if (!supportedProviders.has(manifest.orchestrator.provider)) {
    errors.push(
      `Orchestrator uses unsupported provider '${manifest.orchestrator.provider}'`,
    );
  }
  for (const agent of manifest.agents) {
    if (!supportedProviders.has(agent.provider)) {
      errors.push(`Agent '${agent.id}' uses unsupported provider '${agent.provider}'`);
    }
  }
  for (const task of manifest.tasks) {
    if (!agentIds.has(task.assigneeId)) {
      errors.push(
        `Task '${task.id}' references missing assignee '${task.assigneeId}'`,
      );
    }
    for (const dependency of task.dependsOn) {
      if (dependency === task.id) {
        errors.push(`Task '${task.id}' cannot depend on itself`);
      } else if (!taskIds.has(dependency)) {
        errors.push(`Task '${task.id}' references missing dependency '${dependency}'`);
      }
    }
    if (task.validationCommands.some((command) => command.trim().length === 0)) {
      errors.push(`Task '${task.id}' contains an empty validation command`);
    }
  }

  if (hasDependencyCycle(manifest.tasks)) {
    errors.push("Task graph contains a dependency cycle");
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

function hasDependencyCycle(tasks: OrchestrationManifestV1["tasks"]): boolean {
  const dependencies = new Map(tasks.map((task) => [task.id, task.dependsOn]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (taskId: string): boolean => {
    if (visiting.has(taskId)) return true;
    if (visited.has(taskId)) return false;
    visiting.add(taskId);
    for (const dependency of dependencies.get(taskId) ?? []) {
      if (dependencies.has(dependency) && visit(dependency)) return true;
    }
    visiting.delete(taskId);
    visited.add(taskId);
    return false;
  };

  return tasks.some((task) => visit(task.id));
}
