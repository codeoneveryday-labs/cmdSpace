import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OrchestrationMailOverlay } from "./OrchestrationMailOverlay";
import { createOrchestrationDraft } from "../lib/orchestrationManifest";
import type { ArchitectureNode } from "../lib/architectureCanvasTypes";
import type { OrchestrationRun } from "../lib/orchestrationRuntime";

function node(id: string, x: number): ArchitectureNode {
  return {
    id,
    kind: "terminal",
    label: id,
    technology: "",
    x,
    y: 100,
    width: 620,
    height: 400,
  };
}

function run(): OrchestrationRun {
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

const viewProps = {
  view: { x: 0, y: 0 },
  viewWidth: 2000,
  viewHeight: 1200,
  onFlightDone: () => undefined,
};

describe("OrchestrationMailOverlay", () => {
  it("renders nothing without a run or flights", () => {
    expect(
      renderToStaticMarkup(
        <OrchestrationMailOverlay
          run={null}
          nodes={[]}
          flights={[]}
          {...viewProps}
        />,
      ),
    ).toBe("");
    expect(
      renderToStaticMarkup(
        <OrchestrationMailOverlay
          run={run()}
          nodes={[node("orchestration-worker-build", 96)]}
          flights={[]}
          {...viewProps}
        />,
      ),
    ).toBe("");
  });

  it("flies a tinted envelope from worker to boss", () => {
    const markup = renderToStaticMarkup(
      <OrchestrationMailOverlay
        run={run()}
        nodes={[
          node("orchestration-worker-build", 96),
          {
            ...node("boss-node", 900),
            orchestration: { kind: "orchestrator", entityId: "orchestrator" },
          },
        ]}
        flights={[{ key: "f1", from: "builder", to: "orchestrator", act: "done" }]}
        {...viewProps}
      />,
    );

    expect(markup).toContain("#2ea043");
    expect(markup).toContain("<svg");
  });
});
