import type { ArchitectureDiagram, ArchitectureDiagramNode } from "@/modules/tabs";
import { CLI_AGENT_DEFINITIONS } from "@/modules/terminal/lib/cliAgents";
import type { OrchestrationManifestV1, OrchestrationProvider } from "./orchestrationManifest";

const ORCHESTRATION_PREFIX = "orchestration:";

export function createOrchestrationCanvasDiagram(
  provider: OrchestrationProvider,
  terminalCount = 0,
  workingFolder: string | null = null,
  initialCommands: string[] = [],
): ArchitectureDiagram {
  const terminalNodes = Array.from({ length: terminalCount }, (_, index) => ({
    id: `workspace-terminal-${index + 1}`,
    kind: "terminal" as const,
    label: `Terminal ${index + 1}`,
    technology: "",
    x: index === 0 ? 764 : 96 + ((index - 1) % 2) * 668,
    y: index === 0 ? 96 : 544 + Math.floor((index - 1) / 2) * 448,
    width: 620,
    height: 400,
    ...(workingFolder ? { cwd: workingFolder } : {}),
    ...(initialCommands[index]
      ? { initialCommand: initialCommands[index] }
      : {}),
    terminalChromeVersion: 2 as const,
  }));
  return {
    canvasPurpose: "orchestration",
    orchestrationProvider: provider,
    orchestrationRunId: null,
    nodes: [
      createOrchestratorTerminal(provider, workingFolder),
      ...terminalNodes,
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
  const previousOrchestrator = diagram.nodes.find(
    (node) => node.orchestration?.kind === "orchestrator",
  );
  const orchestratorNode =
    previousOrchestrator?.kind === "terminal"
      ? {
          ...previousOrchestrator,
          label: orchestratorLabel(manifest.orchestrator.provider),
          technology: "Orchestrator CLI agent",
          initialCommand: cliLaunchCommand(manifest.orchestrator.provider),
        }
      : createOrchestratorTerminal(manifest.orchestrator.provider, null);
  const terminalBottom = Math.max(
    ...[orchestratorNode, ...retainedNodes]
      .filter((node) => node.kind === "terminal")
      .map((node) => node.y + node.height),
    0,
  );
  const graphY = terminalBottom + 96;
  const agentNodes = manifest.agents.map((agent, index) => ({
    id: `${ORCHESTRATION_PREFIX}agent:${agent.id}`,
    kind: "agent" as const,
    label: agent.name,
    technology: `${providerLabel(agent.provider)} · ${agent.role}`,
    x: 96 + index * 272,
    y: graphY,
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
      y: graphY + 160 + row * 144,
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

function createOrchestratorTerminal(
  provider: OrchestrationProvider,
  workingFolder: string | null,
): ArchitectureDiagramNode {
  return {
    id: `${ORCHESTRATION_PREFIX}orchestrator`,
    kind: "terminal",
    label: orchestratorLabel(provider),
    technology: "Orchestrator CLI agent",
    x: 96,
    y: 96,
    width: 620,
    height: 400,
    ...(workingFolder ? { cwd: workingFolder } : {}),
    initialCommand: cliLaunchCommand(provider),
    terminalChromeVersion: 2,
    orchestration: { kind: "orchestrator", entityId: "orchestrator" },
  };
}

function cliLaunchCommand(provider: OrchestrationProvider): string {
  return CLI_AGENT_DEFINITIONS.find((agent) => agent.id === provider)?.launch ?? provider;
}

function orchestratorLabel(provider: OrchestrationProvider): string {
  return `Boss · ${providerLabel(provider)}`;
}

function providerLabel(provider: OrchestrationProvider): string {
  if (provider === "cmd") return "Command Code";
  return CLI_AGENT_DEFINITIONS.find((agent) => agent.id === provider)?.name ?? provider;
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
