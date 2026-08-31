import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./CanvasTerminalLayer.tsx", import.meta.url),
  "utf8",
);

describe("CanvasTerminalLayer contract", () => {
  it("owns terminal-world visibility and docking composition without IPC", () => {
    expect(source).toContain("export function CanvasTerminalLayer");
    expect(source).toContain("renderedTerminalDockGroups.map");
    expect(source).toContain("CanvasTerminalGroupHeader");
    expect(source).toContain("CanvasTerminalSurface");
    expect(source).toContain("CanvasDockDivider");
    expect(source).not.toContain("invoke(");
  });
});
