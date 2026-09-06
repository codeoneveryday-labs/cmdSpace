import { describe, expect, it } from "vitest";

import { createOrchestrationDraft } from "./orchestrationManifest";
import type { OrchestrationRun } from "./orchestrationRuntime";
import { drainInstruction, manualWorkerClosing, workerPrompt } from "./orchestrationWorkerPrompt";

function runWithResult(dependencyResult: string | null): OrchestrationRun {
  const manifest = createOrchestrationDraft("Ship it", "codex");
  manifest.tasks = [
    {
      id: "build",
      title: "Build",
      instructions: "Build it.",
      assigneeId: "builder",
      dependsOn: ["setup"],
      writeAccess: true,
      doneWhen: "Tests pass.",
      validationCommands: [],
    },
    {
      id: "setup",
      title: "Setup",
      instructions: "Set up.",
      assigneeId: "builder",
      dependsOn: [],
      writeAccess: true,
      doneWhen: "Ready.",
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
      {
        taskId: "setup",
        status: "completed",
        attempt: 1,
        result: dependencyResult,
        chatId: null,
        runtimeSessionId: null,
        branchName: null,
        worktreePath: null,
      },
    ],
  };
}

describe("workerPrompt", () => {
  it("renders goal, task, and dependency reports", () => {
    const run = runWithResult("Setup is ready.");
    const prompt = workerPrompt(run, run.manifest.tasks[0]!);

    expect(prompt).toContain("Overall goal: Ship it");
    expect(prompt).toContain("Task: Build");
    expect(prompt).toContain("Dependency reports:\nSetup is ready.");
    expect(prompt).toContain("Report a concise outcome when the task is complete.");
  });

  it("renders the manual terminal-worker closing line", () => {
    const run = runWithResult(null);
    const prompt = workerPrompt(run, run.manifest.tasks[0]!, true);

    expect(prompt).toContain("No structured session is attached");
    expect(prompt).toContain("agents/builder/inbox/");
    expect(prompt).not.toContain("Dependency reports:");
  });

  it("points manual workers at concrete hive paths", () => {
    const closing = manualWorkerClosing("run-1", "builder");

    expect(closing).toContain("~/.cmdspace/orchestration/run-1/PROTOCOL.md");
    expect(closing).toContain("agents/builder/outbox/");
  });

  it("tells every worker to drain its inbox via files (no-hook interim)", () => {
    expect(drainInstruction("run-1", "builder")).toContain(
      "~/.cmdspace/orchestration/run-1/agents/builder/inbox",
    );
    expect(drainInstruction("run-1", "builder")).toContain("inbox/.done/");

    const structured = workerPrompt(runWithResult(null), runWithResult(null).manifest.tasks[0]!);
    expect(structured).toContain("Drain your inbox");
    const manual = workerPrompt(runWithResult(null), runWithResult(null).manifest.tasks[0]!, true);
    expect(manual).toContain("Drain your inbox");
  });
});
