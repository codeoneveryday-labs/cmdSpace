import { describe, expect, it } from "vitest";

import { createOrchestrationDraft } from "./orchestrationManifest";
import type { OrchestrationRun } from "./orchestrationRuntime";
import {
  buildOrchestrationSpawnNode,
  buildOrchestrationWorkerNode,
  isManualOrchestrationWorker,
  nextOrchestrationWorkerOrigin,
  orchestrationSpawnNodeId,
  orchestrationWorkerNodeId,
  planOrchestrationSpawnNodes,
  planOrchestrationWorkerSpawns,
  resolveOrchestrationWorkerLaunch,
  tryDeliverWorkerPrompt,
} from "./orchestrationWorkerSpawn";

function runningSnapshot(): OrchestrationRun {
  const manifest = createOrchestrationDraft("Ship it", "codex");
  manifest.agents = [
    { id: "builder", name: "Builder", role: "Implementation", provider: "aider" },
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
    {
      id: "review",
      title: "Review",
      instructions: "Review it.",
      assigneeId: "builder",
      dependsOn: ["build"],
      writeAccess: false,
      doneWhen: "Reviewed.",
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
        worktreePath: "/repo/.cmdspace/worktrees/run-1/build",
      },
      {
        taskId: "review",
        status: "queued",
        attempt: 0,
        result: null,
        chatId: null,
        runtimeSessionId: null,
        branchName: null,
        worktreePath: null,
      },
    ],
  };
}

describe("orchestrationWorkerSpawn", () => {
  it("uses deterministic node ids per task", () => {
    expect(orchestrationWorkerNodeId("build")).toBe("orchestration-worker-build");
  });

  it("resolves launch commands from the CLI catalog with provider fallback", () => {
    expect(resolveOrchestrationWorkerLaunch("aider").launch).toBe("aider");
    expect(resolveOrchestrationWorkerLaunch("codex").displayName).toBe("Codex");
    expect(resolveOrchestrationWorkerLaunch("mystery-cli")).toEqual({
      launch: "mystery-cli",
      displayName: "mystery-cli",
    });
  });

  it("plans spawns only for running tasks missing a node", () => {
    const snapshot = runningSnapshot();

    expect(planOrchestrationWorkerSpawns(snapshot, new Set())).toEqual([
      { taskId: "build", title: "Build", agentName: "Builder", provider: "aider" },
    ]);
    expect(
      planOrchestrationWorkerSpawns(snapshot, new Set(["orchestration-worker-build"])),
    ).toEqual([]);
  });

  it("cascades new worker origins below existing terminals", () => {
    expect(nextOrchestrationWorkerOrigin([])).toEqual({ x: 96, y: 96 });
    expect(
      nextOrchestrationWorkerOrigin([{ x: 96, y: 96, width: 620, height: 400 }]),
    ).toEqual({ x: 764, y: 592 });
  });

  it("builds a task-bound terminal node", () => {
    const node = buildOrchestrationWorkerNode(
      { taskId: "build", title: "Build", agentName: "Builder", provider: "aider" },
      "/repo/.cmdspace/worktrees/run-1/build",
      { x: 96, y: 592 },
    );

    expect(node).toMatchObject({
      id: "orchestration-worker-build",
      kind: "terminal",
      cwd: "/repo/.cmdspace/worktrees/run-1/build",
      initialCommand: "aider",
      terminalChromeVersion: 2,
      orchestration: { kind: "task", entityId: "build" },
    });
  });

  it("classifies manual workers by missing chat transport", () => {
    expect(isManualOrchestrationWorker("aider")).toBe(true);
    expect(isManualOrchestrationWorker("codex")).toBe(false);
    expect(isManualOrchestrationWorker("gemini")).toBe(false);
  });

  it("delivers prompts only through registered injectable handles", () => {
    const injected: string[] = [];
    const handles = new Map([
      ["orchestration-worker-build", { replaceCurrentInput: (next: string) => {
        injected.push(next);
        return true;
      } }],
      ["orchestration-worker-busy", { replaceCurrentInput: () => false }],
    ]);

    expect(tryDeliverWorkerPrompt(handles, "orchestration-worker-build", "Do it.")).toBe(true);
    expect(injected).toEqual(["Do it."]);
    expect(tryDeliverWorkerPrompt(handles, "orchestration-worker-busy", "Do it.")).toBe(false);
    expect(tryDeliverWorkerPrompt(handles, "orchestration-worker-missing", "Do it.")).toBe(false);
    expect(
      tryDeliverWorkerPrompt(
        new Map([["orchestration-worker-throw", { replaceCurrentInput: () => {
          throw new Error("detached");
        } }]]),
        "orchestration-worker-throw",
        "Do it.",
      ),
    ).toBe(false);
  });

  it("plans ephemeral spawn nodes without task bindings", () => {
    const pending = [
      {
        id: "helper-1",
        request: { objective: "Triage inbox", provider: "aider" },
      },
      {
        id: "helper-2",
        request: { objective: "Watch logs", command: "tail -f app.log" },
      },
    ];

    const specs = planOrchestrationSpawnNodes(pending, new Set(), "codex");
    expect(specs).toEqual([
      {
        spawnId: "helper-1",
        title: "Helper helper-1",
        provider: "aider",
        command: null,
        cwd: null,
        objective: "Triage inbox",
      },
      {
        spawnId: "helper-2",
        title: "Helper helper-2",
        provider: "codex",
        command: "tail -f app.log",
        cwd: null,
        objective: "Watch logs",
      },
    ]);
    expect(
      planOrchestrationSpawnNodes(pending, new Set(["orchestration-spawn-helper-1"]), "codex").map(
        (spec) => spec.spawnId,
      ),
    ).toEqual(["helper-2"]);

    const node = buildOrchestrationSpawnNode(specs[0]!, "/repo", { x: 96, y: 96 });
    expect(node).toMatchObject({
      id: "orchestration-spawn-helper-1",
      kind: "terminal",
      cwd: "/repo",
      initialCommand: "aider",
    });
    expect(node.orchestration).toBeUndefined();
    expect(orchestrationSpawnNodeId("helper-1")).toBe("orchestration-spawn-helper-1");
  });
});
