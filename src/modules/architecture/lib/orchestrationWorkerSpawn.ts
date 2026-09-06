import {
  CLI_AGENT_DEFINITIONS,
  ORCHESTRATION_FALLBACK_PROVIDERS,
} from "@/modules/terminal/lib/cliAgents";
import type {
  OrchestrationPendingSpawn,
  OrchestrationRun,
} from "./orchestrationRuntime";
import type { ArchitectureNode } from "./architectureCanvasTypes";

export const ORCHESTRATION_WORKER_NODE_PREFIX = "orchestration-worker-";
export const ORCHESTRATION_SPAWN_NODE_PREFIX = "orchestration-spawn-";

export const ORCHESTRATION_WORKER_NODE_SIZE = { width: 620, height: 400 } as const;

/** Poll cadence for prompt delivery into freshly spawned worker terminals. */
export const ORCHESTRATION_PROMPT_POLL_MS = 750;
/** Give up after ~60s: the CLI never reached an injectable prompt. */
export const ORCHESTRATION_PROMPT_MAX_ATTEMPTS = 80;

export function isManualOrchestrationWorker(provider: string): boolean {
  return ORCHESTRATION_FALLBACK_PROVIDERS.has(provider as never);
}

export function orchestrationWorkerNodeId(taskId: string): string {
  return `${ORCHESTRATION_WORKER_NODE_PREFIX}${taskId}`;
}

export function orchestrationSpawnNodeId(spawnId: string): string {
  return `${ORCHESTRATION_SPAWN_NODE_PREFIX}${spawnId}`;
}

export function resolveOrchestrationWorkerLaunch(provider: string): {
  launch: string;
  displayName: string;
} {
  const definition = CLI_AGENT_DEFINITIONS.find((candidate) => candidate.id === provider);
  return {
    launch: definition?.launch ?? provider,
    displayName: definition?.name ?? provider,
  };
}

export type OrchestrationWorkerSpec = {
  taskId: string;
  title: string;
  agentName: string;
  provider: string;
};

/**
 * Running tasks that still need a Canvas terminal node. A task is skipped
 * when a node id already exists for it (fresh spawn and reload share the
 * same deterministic id, so reconciliation is idempotent).
 */
export function planOrchestrationWorkerSpawns(
  snapshot: OrchestrationRun,
  existingNodeIds: ReadonlySet<string>,
): OrchestrationWorkerSpec[] {
  const specs: OrchestrationWorkerSpec[] = [];
  for (const execution of snapshot.tasks) {
    if (execution.status !== "running") continue;
    if (existingNodeIds.has(orchestrationWorkerNodeId(execution.taskId))) continue;
    const task = snapshot.manifest.tasks.find((candidate) => candidate.id === execution.taskId);
    const agent = snapshot.manifest.agents.find(
      (candidate) => candidate.id === task?.assigneeId,
    );
    if (!task || !agent) continue;
    specs.push({
      taskId: task.id,
      title: task.title,
      agentName: agent.name,
      provider: agent.provider,
    });
  }
  return specs;
}

export function nextOrchestrationWorkerOrigin(
  terminals: Array<{ x: number; y: number; width: number; height: number }>,
): { x: number; y: number } {
  const bottom = terminals.reduce(
    (max, terminal) => Math.max(max, terminal.y + terminal.height),
    0,
  );
  const count = terminals.length;
  return {
    x: 96 + (count % 2) * 668,
    y: (bottom > 0 ? bottom : 96) + (bottom > 0 ? 96 : 0),
  };
}

export function buildOrchestrationWorkerNode(
  spec: OrchestrationWorkerSpec,
  cwd: string,
  origin: { x: number; y: number },
): ArchitectureNode {
  const { displayName } = resolveOrchestrationWorkerLaunch(spec.provider);
  return {
    id: orchestrationWorkerNodeId(spec.taskId),
    kind: "terminal",
    label: spec.title,
    technology: `${displayName} · ${spec.agentName}`,
    x: origin.x,
    y: origin.y,
    width: ORCHESTRATION_WORKER_NODE_SIZE.width,
    height: ORCHESTRATION_WORKER_NODE_SIZE.height,
    cwd,
    initialCommand: resolveOrchestrationWorkerLaunch(spec.provider).launch,
    terminalChromeVersion: 2,
    orchestration: { kind: "task", entityId: spec.taskId },
  };
}

export type WorkerPromptHandle = {
  replaceCurrentInput: (next: string) => boolean;
};

/**
 * Best-effort prompt delivery: clears the worker's current line and types the
 * brief. Returns false while the CLI is mid-command (retry later). Never
 * presses Enter — submitting stays with the human or the Boss.
 */
export function tryDeliverWorkerPrompt(
  handles: ReadonlyMap<string, WorkerPromptHandle>,
  nodeId: string,
  prompt: string,
): boolean {
  const handle = handles.get(nodeId);
  if (!handle) return false;
  try {
    return handle.replaceCurrentInput(prompt);
  } catch {
    return false;
  }
}

export type OrchestrationSpawnSpec = {
  spawnId: string;
  title: string;
  provider: string;
  command: string | null;
  cwd: string | null;
  objective: string;
};

/**
 * Boss-written spawn requests that still need a Canvas terminal node.
 * Ephemeral helpers carry no task binding; the node id derives from the
 * request id so re-polls never duplicate.
 */
export function planOrchestrationSpawnNodes(
  pending: OrchestrationPendingSpawn[],
  existingNodeIds: ReadonlySet<string>,
  fallbackProvider: string,
): OrchestrationSpawnSpec[] {
  return pending
    .filter((item) => !existingNodeIds.has(orchestrationSpawnNodeId(item.id)))
    .map((item) => ({
      spawnId: item.id,
      title: item.request.name?.trim() || `Helper ${item.id}`,
      provider: item.request.provider?.trim() || fallbackProvider,
      command: item.request.command ?? null,
      cwd: item.request.cwd ?? null,
      objective: item.request.objective,
    }));
}

export function buildOrchestrationSpawnNode(
  spec: OrchestrationSpawnSpec,
  cwd: string,
  origin: { x: number; y: number },
): ArchitectureNode {
  const { displayName, launch } = resolveOrchestrationWorkerLaunch(spec.provider);
  return {
    id: orchestrationSpawnNodeId(spec.spawnId),
    kind: "terminal",
    label: spec.title,
    technology: `${displayName} · helper`,
    x: origin.x,
    y: origin.y,
    width: ORCHESTRATION_WORKER_NODE_SIZE.width,
    height: ORCHESTRATION_WORKER_NODE_SIZE.height,
    cwd,
    initialCommand: spec.command ?? launch,
    terminalChromeVersion: 2,
  };
}
