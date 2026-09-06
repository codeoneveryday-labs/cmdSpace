import type {
  OrchestrationHiveMessage,
  OrchestrationMemoryHit,
  OrchestrationRun,
} from "./orchestrationRuntime";

export type OrchestrationMemoryGraphNode = {
  id: string;
  kind: "agent" | "task" | "topic";
  label: string;
};

export type OrchestrationMemoryGraphEdge = {
  from: string;
  to: string;
  kind: "assigned" | "messaged" | "mentions";
};

export type OrchestrationMemoryGraph = {
  nodes: OrchestrationMemoryGraphNode[];
  edges: OrchestrationMemoryGraphEdge[];
};

type TopicCount = {
  topic: string;
  count: number;
};

function topicKey(topic: string): string {
  return `topic:${topic.toLowerCase()}`;
}

function topTopics(
  texts: string[],
  limit: number,
  stopwords: ReadonlySet<string>,
): TopicCount[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const word of text.toLowerCase().split(/[^a-z0-9_]+/)) {
      if (word.length < 4 || stopwords.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
    .slice(0, limit);
}

const DEFAULT_STOPWORDS = new Set([
  "with",
  "from",
  "that",
  "this",
  "have",
  "will",
  "task",
  "agent",
  "work",
  "file",
  "files",
  "into",
  "over",
]);

/**
 * Pure read-view over a run snapshot + mailbox + memory hits: who owns what,
 * who talked to whom, and which topics surface most. No IPC, no store writes —
 * feed it data the canvas already holds.
 */
export function buildOrchestrationMemoryGraph(
  run: OrchestrationRun | null,
  messages: readonly OrchestrationHiveMessage[],
  memoryHits: readonly OrchestrationMemoryHit[],
  topicLimit = 8,
): OrchestrationMemoryGraph {
  const nodes = new Map<string, OrchestrationMemoryGraphNode>();
  const edges: OrchestrationMemoryGraphEdge[] = [];
  const seenEdge = new Set<string>();
  const pushEdge = (edge: OrchestrationMemoryGraphEdge) => {
    const key = `${edge.from}→${edge.to}:${edge.kind}`;
    if (seenEdge.has(key)) return;
    seenEdge.add(key);
    edges.push(edge);
  };

  for (const agent of run?.manifest.agents ?? []) {
    nodes.set(`agent:${agent.id}`, {
      id: `agent:${agent.id}`,
      kind: "agent",
      label: agent.name,
    });
  }
  for (const task of run?.manifest.tasks ?? []) {
    nodes.set(`task:${task.id}`, {
      id: `task:${task.id}`,
      kind: "task",
      label: task.title,
    });
    if (task.assigneeId) {
      pushEdge({
        from: `agent:${task.assigneeId}`,
        to: `task:${task.id}`,
        kind: "assigned",
      });
    }
  }
  for (const message of messages) {
    if (message.from && message.to) {
      pushEdge({ from: message.from, to: message.to, kind: "messaged" });
    }
  }

  const texts = [
    ...messages.map((message) => `${message.subject} ${message.body}`),
    ...memoryHits.map((hit) => `${hit.source} ${hit.snippet}`),
  ];
  for (const { topic } of topTopics(texts, topicLimit, DEFAULT_STOPWORDS)) {
    nodes.set(topicKey(topic), { id: topicKey(topic), kind: "topic", label: topic });
  }
  return { nodes: [...nodes.values()], edges };
}

export function linkMemoryHitsToGraph(
  graph: OrchestrationMemoryGraph,
  memoryHits: readonly OrchestrationMemoryHit[],
): OrchestrationMemoryGraph {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = [...graph.edges];
  for (const hit of memoryHits) {
    const agentId = `agent:${hit.agentId}`;
    if (!nodes.has(agentId)) {
      nodes.set(agentId, { id: agentId, kind: "agent", label: hit.agentId });
    }
    for (const [id, node] of nodes) {
      if (node.kind !== "topic") continue;
      if (hit.snippet.toLowerCase().includes(node.label)) {
        edges.push({ from: agentId, to: id, kind: "mentions" });
      }
    }
  }
  return { nodes: [...nodes.values()], edges };
}
