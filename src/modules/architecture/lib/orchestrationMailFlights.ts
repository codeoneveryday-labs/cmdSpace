import type { ArchitectureNode } from "./architectureCanvasTypes";
import {
  ORCHESTRATION_MAIL_BROADCAST,
  ORCHESTRATION_MAIL_ORCHESTRATOR_ID,
  type OrchestrationEvent,
  type OrchestrationRun,
} from "./orchestrationRuntime";
import { orchestrationWorkerNodeId } from "./orchestrationWorkerSpawn";

/** Max concurrent envelopes — a broadcast must never bury the canvas. */
export const ORCHESTRATION_MAIL_MAX_FLIGHTS = 8;

/** Speech-act → envelope tint. */
export const ORCHESTRATION_MAIL_ACT_TINTS: Record<string, string> = {
  request: "#58a6ff",
  query: "#a371f7",
  propose: "#d29922",
  inform: "#8b949e",
  agree: "#2ea043",
  done: "#2ea043",
  refuse: "#f85149",
};

export type OrchestrationMailFlight = {
  key: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  tint: string;
  act: string;
};

type MailSentPayload = {
  mail?: unknown;
  id?: unknown;
  from?: unknown;
  to?: unknown;
  act?: unknown;
};

function nodeCenter(node: ArchitectureNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function nodeForAgent(
  nodes: readonly ArchitectureNode[],
  run: OrchestrationRun,
  agentId: string,
): ArchitectureNode | null {
  if (agentId === ORCHESTRATION_MAIL_ORCHESTRATOR_ID) {
    return (
      nodes.find((node) => node.orchestration?.kind === "orchestrator") ??
      nodes.find((node) => node.kind === "terminal") ??
      null
    );
  }
  const assigned = run.manifest.tasks.filter((task) => task.assigneeId === agentId);
  const runningFirst = [...assigned].sort((left, right) => {
    const leftRunning =
      run.tasks.find((task) => task.taskId === left.id)?.status === "running" ? 0 : 1;
    const rightRunning =
      run.tasks.find((task) => task.taskId === right.id)?.status === "running" ? 0 : 1;
    return leftRunning - rightRunning;
  });
  for (const task of runningFirst) {
    const node = nodes.find((candidate) => candidate.id === orchestrationWorkerNodeId(task.id));
    if (node) return node;
  }
  return null;
}

/**
 * Resolve a sent-mail event into flight endpoints. Broadcast fans out to at
 * most three recipient nodes (never the sender). Returns empty when either
 * end has no node on the canvas.
 */
export function resolveMailFlightEndpoints(
  run: OrchestrationRun,
  nodes: readonly ArchitectureNode[],
  from: string,
  to: string,
  act: string,
): OrchestrationMailFlight[] {
  const tint = ORCHESTRATION_MAIL_ACT_TINTS[act] ?? ORCHESTRATION_MAIL_ACT_TINTS.inform!;
  const fromNode = nodeForAgent(nodes, run, from);
  if (!fromNode) return [];
  const recipients =
    to === ORCHESTRATION_MAIL_BROADCAST
      ? run.manifest.agents
          .map((agent) => agent.id)
          .concat(ORCHESTRATION_MAIL_ORCHESTRATOR_ID)
          .filter((id) => id !== from)
          .slice(0, 3)
      : [to];
  const flights: OrchestrationMailFlight[] = [];
  for (const recipient of recipients) {
    const toNode = nodeForAgent(nodes, run, recipient);
    if (!toNode || toNode.id === fromNode.id) continue;
    flights.push({
      key: `${from}→${recipient}:${Date.now().toString(36)}`,
      from: nodeCenter(fromNode),
      to: nodeCenter(toNode),
      tint,
      act,
    });
  }
  return flights;
}

function parseMailSentPayload(event: OrchestrationEvent): MailSentPayload | null {
  if (event.eventType !== "task_activity") return null;
  const payload = event.payload;
  if (typeof payload !== "object" || payload === null) return null;
  const mail = (payload as MailSentPayload).mail;
  if (mail !== "sent") return null;
  return payload as MailSentPayload;
}

export type OrchestrationMailRoute = {
  from: string;
  to: string;
  act: string;
};

/** Extract the sender/recipient/act of a mail-sent notification, if any. */
export function parseMailSentRoute(event: OrchestrationEvent): OrchestrationMailRoute | null {
  const payload = parseMailSentPayload(event);
  if (!payload || typeof payload.from !== "string" || typeof payload.to !== "string") {
    return null;
  }
  return {
    from: payload.from,
    to: payload.to,
    act: typeof payload.act === "string" ? payload.act : "inform",
  };
}

/**
 * Turn a live run event into envelope flights. Anything that is not a
 * mail-sent notification yields no flights.
 */
export function mailFlightsForEvent(
  run: OrchestrationRun,
  nodes: readonly ArchitectureNode[],
  event: OrchestrationEvent,
): OrchestrationMailFlight[] {
  const route = parseMailSentRoute(event);
  if (!route) return [];
  return resolveMailFlightEndpoints(run, nodes, route.from, route.to, route.act);
}
