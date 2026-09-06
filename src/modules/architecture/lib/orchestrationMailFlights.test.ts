import { describe, expect, it } from "vitest";

import { createOrchestrationDraft } from "./orchestrationManifest";
import type { OrchestrationEvent, OrchestrationRun } from "./orchestrationRuntime";
import {
  mailFlightsForEvent,
  ORCHESTRATION_MAIL_ACT_TINTS,
  resolveMailFlightEndpoints,
} from "./orchestrationMailFlights";
import type { ArchitectureNode } from "./architectureCanvasTypes";

function node(id: string, x: number, binding?: ArchitectureNode["orchestration"]): ArchitectureNode {
  return {
    id,
    kind: "terminal",
    label: id,
    technology: "",
    x,
    y: 100,
    width: 620,
    height: 400,
    ...(binding ? { orchestration: binding } : {}),
  };
}

function run(): OrchestrationRun {
  const manifest = createOrchestrationDraft("Ship it", "codex");
  manifest.agents = [
    { id: "builder", name: "Builder", role: "Implementation", provider: "aider" },
    { id: "reviewer", name: "Reviewer", role: "Verification", provider: "codex" },
  ];
  manifest.tasks = [
    {
      id: "build",
      title: "Build",
      instructions: "Build it.",
      assigneeId: "builder",
      dependsOn: [],
      writeAccess: true,
      doneWhen: "Tests pass.",
      validationCommands: [],
    },
  ];
  return {
    id: "run-1",
    workspaceId: "workspace-1",
    cwd: "/repo",
    sourceCommit: null,
    integrationBranch: null,
    integrationWorktree: null,
    revision: 1,
    status: "running",
    manifest,
    tasks: [
      {
        taskId: "build",
        status: "running",
        attempt: 1,
        result: null,
        chatId: null,
        runtimeSessionId: null,
        branchName: null,
        worktreePath: null,
      },
    ],
  };
}

function nodes(): ArchitectureNode[] {
  return [
    node("orchestration-worker-build", 96),
    node("boss-node", 900, { kind: "orchestrator", entityId: "orchestrator" }),
  ];
}

function sentEvent(payload: unknown): OrchestrationEvent {
  return {
    sequence: 1,
    runId: "run-1",
    taskId: null,
    eventType: "task_activity",
    timestamp: 1,
    payload,
  };
}

describe("orchestrationMailFlights", () => {
  it("tints envelopes by speech act", () => {
    expect(ORCHESTRATION_MAIL_ACT_TINTS.request).toBe("#58a6ff");
    expect(ORCHESTRATION_MAIL_ACT_TINTS.done).toBe("#2ea043");
  });

  it("flies worker to boss on done mail", () => {
    const flights = resolveMailFlightEndpoints(run(), nodes(), "builder", "orchestrator", "done");

    expect(flights).toHaveLength(1);
    expect(flights[0]).toMatchObject({ act: "done", tint: "#2ea043" });
    expect(flights[0]!.from.x).toBeLessThan(flights[0]!.to.x);
  });

  it("fans broadcast out to recipients, never the sender", () => {
    const flights = resolveMailFlightEndpoints(run(), nodes(), "builder", "broadcast", "inform");

    expect(flights).toHaveLength(1);
    expect(flights[0]!.to.x).toBeGreaterThan(900);
  });

  it("yields nothing without nodes or for non-mail events", () => {
    expect(resolveMailFlightEndpoints(run(), [], "builder", "orchestrator", "done")).toEqual([]);
    expect(
      mailFlightsForEvent(run(), nodes(), sentEvent({ mail: "routed", delivered: 1 })),
    ).toEqual([]);
    expect(mailFlightsForEvent(run(), nodes(), sentEvent(null))).toEqual([]);
  });

  it("parses sent events with act fallback", () => {
    const flights = mailFlightsForEvent(
      run(),
      nodes(),
      sentEvent({ mail: "sent", from: "builder", to: "orchestrator", act: "request" }),
    );

    expect(flights).toHaveLength(1);
    expect(flights[0]!.tint).toBe("#58a6ff");

    const fallback = mailFlightsForEvent(
      run(),
      nodes(),
      sentEvent({ mail: "sent", from: "builder", to: "orchestrator" }),
    );
    expect(fallback[0]!.tint).toBe("#8b949e");
  });
});
