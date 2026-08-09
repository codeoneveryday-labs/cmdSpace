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
    {
      id: "browser-1",
      kind: "browser",
      label: "Browser",
      technology: "Web",
      x: 80,
      y: 720,
      width: 720,
      height: 480,
      url: "https://example.com",
    },
    {
      id: "editor-1",
      kind: "editor",
      label: "example.ts",
      technology: "CodeMirror",
      x: 840,
      y: 720,
      width: 720,
      height: 480,
      path: "/tmp/example.ts",
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

  it("round-trips browser URLs and editor file paths", () => {
    const restored = parseCanvasWorkspaceDiagram(
      serializeCanvasWorkspaceDiagram(splitDiagram),
    );

    expect(restored?.nodes.find((node) => node.kind === "browser")?.url).toBe(
      "https://example.com",
    );
    expect(restored?.nodes.find((node) => node.kind === "editor")?.path).toBe(
      "/tmp/example.ts",
    );
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
