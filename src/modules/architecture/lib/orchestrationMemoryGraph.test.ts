import { describe, expect, it } from "vitest";

import {
  buildOrchestrationMemoryGraph,
  linkMemoryHitsToGraph,
} from "./orchestrationMemoryGraph";
import type {
  OrchestrationHiveMessage,
  OrchestrationMemoryHit,
  OrchestrationRun,
} from "./orchestrationRuntime";

function runFixture(): OrchestrationRun {
  return {
    id: "run-1",
    workspaceId: "ws",
    cwd: "/tmp/ws",
    sourceCommit: null,
    integrationBranch: null,
    integrationWorktree: null,
    revision: 1,
    status: "running",
    manifest: {
      version: 1,
      goal: "ship",
      orchestrator: { provider: "codex", role: "boss" },
      agents: [
        { id: "a1", name: "Amy", provider: "codex", role: "worker" },
        { id: "a2", name: "Bob", provider: "claude", role: "worker" },
      ],
      tasks: [
        {
          id: "t1",
          title: "Build widget",
          doneWhen: "tests pass",
          assigneeId: "a1",
          dependsOn: [],
        },
        {
          id: "t2",
          title: "Document widget",
          doneWhen: "docs merged",
          assigneeId: "a2",
          dependsOn: ["t1"],
        },
      ],
    },
    tasks: [],
  } as unknown as OrchestrationRun;
}

function messageFixture(
  overrides: Partial<OrchestrationHiveMessage> = {},
): OrchestrationHiveMessage {
  return {
    id: "m1",
    conversation: "c1",
    inReplyTo: null,
    from: "agent:a1",
    to: "agent:a2",
    act: "inform",
    subject: "widget progress",
    body: "widget implementation finished, widget tests green",
    hops: 0,
    requiresReply: false,
    needsHuman: false,
    createdAt: 0,
    ...overrides,
  };
}

describe("buildOrchestrationMemoryGraph", () => {
  it("maps agents, tasks, assignments, and message links", () => {
    const graph = buildOrchestrationMemoryGraph(
      runFixture(),
      [messageFixture()],
      [],
    );
    const ids = new Set(graph.nodes.map((node) => node.id));
    expect(ids.has("agent:a1")).toBe(true);
    expect(ids.has("agent:a2")).toBe(true);
    expect(ids.has("task:t1")).toBe(true);
    expect(graph.edges).toContainEqual({
      from: "agent:a1",
      to: "task:t1",
      kind: "assigned",
    });
    expect(graph.edges).toContainEqual({
      from: "agent:a1",
      to: "agent:a2",
      kind: "messaged",
    });
  });

  it("extracts frequent topics without new IPC", () => {
    const graph = buildOrchestrationMemoryGraph(
      runFixture(),
      [messageFixture()],
      [],
      4,
    );
    const topics = graph.nodes.filter((node) => node.kind === "topic");
    expect(topics.map((node) => node.label)).toContain("widget");
  });

  it("handles a null run without throwing", () => {
    const graph = buildOrchestrationMemoryGraph(null, [], []);
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});

describe("linkMemoryHitsToGraph", () => {
  it("links memory hits mentioning a topic to the agent", () => {
    const hit: OrchestrationMemoryHit = {
      source: "agents/a1/memory.md",
      agentId: "a1",
      snippet: "remember the widget rollout plan",
    };
    const graph = buildOrchestrationMemoryGraph(runFixture(), [], [hit, hit]);
    const linked = linkMemoryHitsToGraph(graph, [hit]);
    expect(
      linked.edges.some(
        (edge) => edge.from === "agent:a1" && edge.kind === "mentions",
      ),
    ).toBe(true);
  });
});
