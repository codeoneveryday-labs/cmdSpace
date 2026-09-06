import { useMemo } from "react";

import {
  buildOrchestrationMemoryGraph,
  linkMemoryHitsToGraph,
  type OrchestrationMemoryGraph,
} from "../lib/orchestrationMemoryGraph";
import type {
  OrchestrationHiveMessage,
  OrchestrationMemoryHit,
  OrchestrationRun,
} from "../lib/orchestrationRuntime";

function graphNodeTone(kind: OrchestrationMemoryGraph["nodes"][number]["kind"]): string {
  switch (kind) {
    case "agent":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "task":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "topic":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
}

/**
 * Read-view over the run manifest plus loaded memory hits: who owns what,
 * which topics surface. Pure render of the graph model — no IPC, no store.
 */
export function OrchestrationMemoryGraphView({
  run,
  messages,
  memoryHits,
}: {
  run: OrchestrationRun | null;
  messages: readonly OrchestrationHiveMessage[];
  memoryHits: readonly OrchestrationMemoryHit[];
}) {
  const graph = useMemo(() => {
    const repeated = memoryHits.length > 0 ? [...memoryHits, ...memoryHits] : [];
    return linkMemoryHitsToGraph(
      buildOrchestrationMemoryGraph(run, messages, repeated),
      memoryHits,
    );
  }, [run, messages, memoryHits]);
  const agents = graph.nodes.filter((node) => node.kind === "agent");
  const tasks = graph.nodes.filter((node) => node.kind === "task");
  const topics = graph.nodes.filter((node) => node.kind === "topic");
  if (agents.length === 0 && tasks.length === 0 && topics.length === 0) {
    return null;
  }
  return (
    <div className="mt-1.5 rounded border border-zinc-200 p-1.5 dark:border-zinc-700">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Graph · {agents.length} agents · {tasks.length} tasks · {topics.length}{" "}
        topics · {graph.edges.length} links
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {graph.nodes.slice(0, 24).map((node) => (
          <span
            key={node.id}
            title={`${node.kind}: ${node.label} (${graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id).length} links)`}
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${graphNodeTone(node.kind)}`}
          >
            {node.label}
          </span>
        ))}
      </div>
    </div>
  );
}
