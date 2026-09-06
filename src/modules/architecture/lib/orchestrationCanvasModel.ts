import type { ArchitectureDiagram } from "@/modules/tabs";
import type { OrchestrationManifestV1, OrchestrationProvider } from "./orchestrationManifest";

const ORCHESTRATION_PREFIX = "orchestration:";

export function createOrchestrationCanvasDiagram(
  provider: OrchestrationProvider,
): ArchitectureDiagram {
  return {
    canvasPurpose: "orchestration",
    orchestrationProvider: provider,
    orchestrationRunId: null,
    nodes: [
      {
        id: `${ORCHESTRATION_PREFIX}orchestrator`,
        kind: "orchestrator",
        label: "Orchestrator",
        technology: providerLabel(provider),
        x: 96,
        y: 96,
        width: 220,
        height: 96,
        orchestration: { kind: "orchestrator", entityId: "orchestrator" },
      },
    ],
    edges: [],
  };
}

export function applyManifestToOrchestrationDiagram(
  diagram: ArchitectureDiagram,
  manifest: OrchestrationManifestV1,
  runId: string,
): ArchitectureDiagram {
  const retainedNodes = diagram.nodes.filter((node) => !node.orchestration);
  const retainedEdges = diagram.edges.filter((edge) => !edge.orchestration);
  const orchestratorNode = {
    id: `${ORCHESTRATION_PREFIX}orchestrator`,
    kind: "orchestrator" as const,
    label: manifest.title || "Orchestrator",
    technology: providerLabel(manifest.orchestrator.provider),
    x: 96,
    y: 96,
    width: 240,
    height: 104,
    orchestration: { kind: "orchestrator" as const, entityId: "orchestrator" as const },
  };
  const agentNodes = manifest.agents.map((agent, index) => ({
    id: `${ORCHESTRATION_PREFIX}agent:${agent.id}`,
    kind: "agent" as const,
    label: agent.name,
    technology: `${providerLabel(agent.provider)} · ${agent.role}`,
    x: 96 + index * 272,
    y: 280,
    width: 224,
    height: 96,
    orchestration: { kind: "agent" as const, entityId: agent.id },
  }));
  const depthByTask = taskDepths(manifest);
  const depthRows = new Map<number, number>();
  const taskNodes = manifest.tasks.map((task) => {
    const depth = depthByTask.get(task.id) ?? 0;
    const row = depthRows.get(depth) ?? 0;
    depthRows.set(depth, row + 1);
    return {
      id: `${ORCHESTRATION_PREFIX}task:${task.id}`,
      kind: "task" as const,
      label: task.title,
      technology: task.doneWhen,
      x: 96 + depth * 320,
      y: 480 + row * 144,
      width: 248,
      height: 104,
      orchestration: { kind: "task" as const, entityId: task.id },
    };
  });
  const assignmentEdges = manifest.tasks.map((task) => ({
    id: `${ORCHESTRATION_PREFIX}assignment:${task.id}`,
    from: `${ORCHESTRATION_PREFIX}agent:${task.assigneeId}`,
    to: `${ORCHESTRATION_PREFIX}task:${task.id}`,
    label: "assigned",
    orchestration: {
      kind: "assignment" as const,
      agentId: task.assigneeId,
      taskId: task.id,
    },
  }));
  const dependencyEdges = manifest.tasks.flatMap((task) =>
    task.dependsOn.map((dependency) => ({
      id: `${ORCHESTRATION_PREFIX}dependency:${dependency}:${task.id}`,
      from: `${ORCHESTRATION_PREFIX}task:${dependency}`,
      to: `${ORCHESTRATION_PREFIX}task:${task.id}`,
      label: "depends on",
      orchestration: {
        kind: "dependency" as const,
        fromTaskId: dependency,
        toTaskId: task.id,
      },
    })),
  );

  return {
    ...diagram,
    canvasPurpose: "orchestration",
    orchestrationProvider: manifest.orchestrator.provider,
    orchestrationRunId: runId,
    nodes: [
      ...retainedNodes,
      orchestratorNode,
      ...agentNodes,
      ...taskNodes,
    ],
    edges: [...retainedEdges, ...assignmentEdges, ...dependencyEdges],
  };
}

function providerLabel(provider: OrchestrationProvider): string {
  if (provider === "cmd") return "Command Code";
  return provider === "codex" ? "Codex" : "Claude";
}

function taskDepths(manifest: OrchestrationManifestV1): Map<string, number> {
  const dependencies = new Map(
    manifest.tasks.map((task) => [task.id, task.dependsOn]),
  );
  const depths = new Map<string, number>();
  const depthOf = (taskId: string): number => {
    const cached = depths.get(taskId);
    if (cached !== undefined) return cached;
    const depth = Math.max(
      0,
      ...(dependencies.get(taskId) ?? []).map((dependency) => depthOf(dependency) + 1),
    );
    depths.set(taskId, depth);
    return depth;
  };
  for (const task of manifest.tasks) depthOf(task.id);
  return depths;
}
