import { describe, expect, it } from "vitest";

import type { ArchitectureDiagram } from "@/modules/tabs";

import {
  parseCanvasWorkspaceDiagram,
  serializeCanvasWorkspaceDiagram,
} from "./canvasWorkspacePersistence";

const splitDiagram: ArchitectureDiagram = {
  nodes: [
    {
      id: "terminal-1",
      kind: "terminal",
      label: "Codex 1",
      technology: "zsh",
      x: 120,
      y: 180,
      width: 900,
      height: 560,
      cwd: "/tmp/project",
      initialCommand: "codex",
    },
    {
      id: "terminal-2",
      kind: "terminal",
      label: "Codex 2",
      technology: "zsh",
      x: 760,
      y: 180,
      width: 640,
      height: 400,
      cwd: "/tmp/project",
      initialCommand: "codex",
    },
  ],
  edges: [],
  terminalDockGroups: [
    {
      id: "group-1",
      x: 120,
      y: 180,
      width: 900,
      height: 560,
      root: {
        id: "split-1",
        kind: "split",
        direction: "horizontal",
        ratio: 0.42,
        first: {
          id: "stack-1",
          kind: "tabs",
          terminalIds: ["terminal-1"],
          activeTerminalId: "terminal-1",
        },
        second: {
          id: "stack-2",
          kind: "tabs",
          terminalIds: ["terminal-2"],
          activeTerminalId: "terminal-2",
        },
      },
    },
  ],
};

describe("canvas workspace persistence", () => {
  it("round-trips terminal positions and the complete dock tree", () => {
    const persisted = serializeCanvasWorkspaceDiagram(splitDiagram);

    expect(parseCanvasWorkspaceDiagram(persisted)).toEqual(splitDiagram);
  });

  it("does not mistake a standard terminal pane layout for a canvas diagram", () => {
    const standardPaneLayout = JSON.stringify({
      kind: "split",
      dir: "row",
      children: [{ kind: "leaf" }, { kind: "leaf" }],
    });

    expect(parseCanvasWorkspaceDiagram(standardPaneLayout)).toBeNull();
    expect(parseCanvasWorkspaceDiagram("{invalid json")).toBeNull();
    expect(parseCanvasWorkspaceDiagram(null)).toBeNull();
  });
});
