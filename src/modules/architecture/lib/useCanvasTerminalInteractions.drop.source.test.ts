import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = [
  readFileSync(new URL("./useCanvasTerminalInteractions.ts", import.meta.url), "utf8"),
  readFileSync(new URL("./canvasTerminalInteractionModel.ts", import.meta.url), "utf8"),
  readFileSync(new URL("./canvasTerminalInteractionCommit.ts", import.meta.url), "utf8"),
].join("\n");

describe("terminal drop commit contract", () => {
  it("keeps dock, detach and frame-sync mutations behind the interaction seam", () => {
    expect(source).toContain("export function commitTerminalDropResult");
    expect(source).toContain('result.kind === "dock"');
    expect(source).toContain('result.kind === "detach"');
    expect(source).toContain('result.kind === "sync-frame"');
    expect(source).toContain("updateDraggedNodes");
  });
});
