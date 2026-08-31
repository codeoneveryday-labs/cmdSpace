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

  it("creates browser surfaces with an empty URL", () => {
    expect(
      createSurfaceNode({
        id: "n2",
        kind: "browser",
        x: 0,
        y: 0,
        width: 720,
        height: 480,
      }),
    ).toMatchObject({ kind: "browser", url: "", width: 720, height: 480 });
  });
});
