import { describe, expect, it } from "vitest";
import { createDockedSurfaceState } from "./architectureDiagramSeed";
import type { ArchitectureNode } from "./architectureCanvasTypes";

const source: ArchitectureNode = {
  id: "source",
  kind: "terminal",
  label: "Terminal",
  technology: "shell",
  x: 0,
  y: 0,
  width: 640,
  height: 400,
  cwd: "/repo",
};

describe("createDockedSurfaceState", () => {
  it("creates a new terminal and docks it as a tab", () => {
    const result = createDockedSurfaceState({
      id: "created",
      source,
      target: {
        groupId: "group",
        stackId: "stack",
        rect: { x: 10, y: 20, width: 300, height: 200 },
      },
      dockKind: "tab",
      liveSurfaceNodes: [source],
      terminalDockGroups: [],
      initialCommand: "codex",
    });

    expect(result.created).toMatchObject({
      id: "created",
      cwd: "/repo",
      initialCommand: "codex",
    });
    expect(result.terminalDockGroups).toHaveLength(2);
  });

  it("reuses a prepared node when only the dock transition is recalculated", () => {
    const prepared = { ...source, id: "prepared" };
    const result = createDockedSurfaceState({
      id: prepared.id,
      source,
      created: prepared,
      target: {
        groupId: "group",
        stackId: "stack",
        rect: { x: 10, y: 20, width: 300, height: 200 },
      },
      dockKind: "split",
      liveSurfaceNodes: [source],
      terminalDockGroups: [],
    });

    expect(result.created).toBe(prepared);
  });
});
