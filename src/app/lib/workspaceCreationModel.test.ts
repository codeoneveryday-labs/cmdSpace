import { describe, expect, it } from "vitest";
import {
  buildCanvasWorkspaceDiagram,
  nextWorkspaceName,
  resolveWorkspaceCreationPlan,
  workspaceAccentForIndex,
} from "./workspaceCreationModel";

describe("workspaceCreationModel", () => {
  it("lays out canvas terminals in one or two columns", () => {
    const diagram = buildCanvasWorkspaceDiagram(3, "/repo", ["codex"]);

    expect(diagram.nodes).toHaveLength(3);
    expect(diagram.nodes[0]).toMatchObject({ x: 96, y: 96, cwd: "/repo", initialCommand: "codex" });
    expect(diagram.nodes[2]).toMatchObject({ x: 96, y: 544 });
  });

  it("finds the first unused workspace name and cycles accents", () => {
    expect(nextWorkspaceName([
      { id: "workspace-01", name: "workspace-01" } as never,
    ])).toBe("workspace-02");
    expect(workspaceAccentForIndex(0)).toBeTruthy();
  });

  it("builds a canvas/agent-aware creation plan without creating tabs", () => {
    const plan = resolveWorkspaceCreationPlan({
      terminalCount: 2,
      workingFolder: null,
      inheritedCwd: "/repo",
      initialCommands: ["codex"],
      requestedName: "  Project  ",
      workspaceMode: "agent",
      workspaceAgents: ["codex", "claude", "gemini"],
      workspaces: [],
    });

    expect(plan).toMatchObject({
      name: "Project",
      effectiveWorkingFolder: "/repo",
      agentProviders: ["codex", "claude", "gemini"],
    });
    expect(plan.paneLaunchPlan).toHaveLength(2);
    expect(plan.canvasDiagram).toBeNull();
  });
});
