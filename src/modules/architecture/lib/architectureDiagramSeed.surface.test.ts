import { describe, expect, it } from "vitest";
import { createSurfaceNode } from "./architectureDiagramSeed";

describe("createSurfaceNode", () => {
  it("creates terminal metadata without leaking browser fields", () => {
    expect(
      createSurfaceNode({
        id: "n1",
        kind: "terminal",
        x: 10,
        y: 20,
        width: 640,
        height: 400,
        cwd: "/repo",
        initialCommand: "codex",
        frameId: "frame-1",
      }),
    ).toMatchObject({
      terminalChromeVersion: 2,
      cwd: "/repo",
      initialCommand: "codex",
      frameId: "frame-1",
    });
  });
});
