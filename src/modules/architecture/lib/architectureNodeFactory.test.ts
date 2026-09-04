import { describe, expect, it } from "vitest";
import { createCanvasNode, createSurfaceNode } from "./architectureNodeFactory";

describe("architectureNodeFactory", () => {
  it("creates bounded terminal nodes with terminal metadata", () => {
    const terminal = createCanvasNode({
      id: "terminal",
      kind: "terminal",
      point: { x: 200, y: 150 },
      bounds: { x: 0, y: 0, width: 1200, height: 720 },
    });

    expect(terminal).toMatchObject({
      kind: "terminal",
      terminalChromeVersion: 2,
      width: 640,
      height: 400,
    });
  });

  it("creates surface-specific fields without leaking terminal fields", () => {
    expect(
      createSurfaceNode({
        id: "terminal",
        kind: "terminal",
        x: 1,
        y: 2,
        width: 640,
        height: 400,
        cwd: "/repo",
        initialCommand: "codex",
      }),
    ).toMatchObject({
      kind: "terminal",
      cwd: "/repo",
      initialCommand: "codex",
      terminalChromeVersion: 2,
    });
  });
});
