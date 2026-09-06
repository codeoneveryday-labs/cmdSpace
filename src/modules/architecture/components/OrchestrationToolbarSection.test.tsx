import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { OrchestrationToolbarSection } from "./OrchestrationToolbarSection";
import type { OrchestrationRun } from "../lib/orchestrationRuntime";
import { createOrchestrationDraft } from "../lib/orchestrationManifest";

function controls(run: OrchestrationRun | null) {
  return {
    run,
    busy: false,
    error: null,
    onStartRun: vi.fn(),
    onSaveDraft: vi.fn(),
    onApprove: vi.fn(),
    onCompleteTask: vi.fn(),
    onRetryTask: vi.fn(),
    onReindexMemories: vi.fn(),
    onSearchMemories: vi.fn(),
  };
}

function runningRun(): OrchestrationRun {
  const manifest = createOrchestrationDraft("Ship it", "codex");
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
        taskId: "initial-task",
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

describe("OrchestrationToolbarSection", () => {
  it("renders nothing without controls", () => {
    expect(renderToStaticMarkup(<OrchestrationToolbarSection controls={null} />)).toBe("");
  });

  it("offers a run bootstrap without a second chat surface", () => {
    const markup = renderToStaticMarkup(<OrchestrationToolbarSection controls={controls(null)} />);

    expect(markup).toContain("Orchestrate");
    expect(markup).not.toContain("Agent orchestration");
  });

  it("shows a tasks entry point without a second chat surface", () => {
    const markup = renderToStaticMarkup(
      <OrchestrationToolbarSection controls={controls(runningRun())} />,
    );

    expect(markup).toContain("Tasks");
    expect(markup).not.toContain("Agent orchestration");
  });
});
