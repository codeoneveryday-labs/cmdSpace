import { describe, expect, it } from "vitest";
import type { OrchestrationManifestV1 } from "./orchestrationManifest";
import {
  applyManifestToOrchestrationDiagram,
  createOrchestrationCanvasDiagram,
} from "./orchestrationCanvasModel";

const manifest: OrchestrationManifestV1 = {
  version: 1,
  title: "Canvas orchestration",
  goal: "Build the approved graph",
  orchestrator: { provider: "codex" },
  agents: [
    { id: "builder", name: "Builder", role: "Implementation", provider: "claude" },
    { id: "reviewer", name: "Reviewer", role: "Verification", provider: "cmd" },
  ],
  tasks: [
    {
      id: "build",
      title: "Build",
      instructions: "Implement the feature.",
      assigneeId: "builder",
      dependsOn: [],
      writeAccess: true,
      doneWhen: "Tests pass",
      validationCommands: ["pnpm test"],
    },
    {
      id: "review",
      title: "Review",
      instructions: "Review the diff.",
      assigneeId: "reviewer",
      dependsOn: ["build"],
      writeAccess: false,
      doneWhen: "No blocking findings",
      validationCommands: [],
    },
  ],
};

describe("orchestrationCanvasModel", () => {
  it("creates an orchestration template with a distinct orchestrator node", () => {
    const diagram = createOrchestrationCanvasDiagram("codex", 2, "/repo");

    expect(diagram).toMatchObject({
      canvasPurpose: "orchestration",
      orchestrationProvider: "codex",
      orchestrationRunId: null,
      edges: [],
    });
    expect(diagram.nodes.filter((node) => node.kind === "terminal")).toHaveLength(2);
    expect(diagram.nodes[0]).toMatchObject({
      id: "orchestration:orchestrator",
      kind: "orchestrator",
      label: "Orchestrator",
      technology: "Codex",
      orchestration: { kind: "orchestrator", entityId: "orchestrator" },
    });
  });

  it("projects approved agents, tasks, assignments, and dependencies deterministically", () => {
    const diagram = applyManifestToOrchestrationDiagram(
      createOrchestrationCanvasDiagram("codex"),
      manifest,
      "run-1",
    );

    expect(diagram.orchestrationRunId).toBe("run-1");
    expect(diagram.nodes.map((node) => [node.kind, node.id])).toEqual([
      ["orchestrator", "orchestration:orchestrator"],
      ["agent", "orchestration:agent:builder"],
      ["agent", "orchestration:agent:reviewer"],
      ["task", "orchestration:task:build"],
      ["task", "orchestration:task:review"],
    ]);
    expect(diagram.edges.map((edge) => edge.orchestration)).toEqual([
      { kind: "assignment", agentId: "builder", taskId: "build" },
      { kind: "assignment", agentId: "reviewer", taskId: "review" },
      { kind: "dependency", fromTaskId: "build", toTaskId: "review" },
    ]);
  });

  it("preserves drawing and terminal nodes when a proposal revision is applied", () => {
    const seed = createOrchestrationCanvasDiagram("codex");
    seed.nodes.push({
      id: "note",
      kind: "text",
      label: "Keep me",
      technology: "",
      x: 12,
      y: 12,
      width: 120,
      height: 40,
    });

    const diagram = applyManifestToOrchestrationDiagram(seed, manifest, "run-2");

    expect(diagram.nodes.some((node) => node.id === "note")).toBe(true);
  });
});
