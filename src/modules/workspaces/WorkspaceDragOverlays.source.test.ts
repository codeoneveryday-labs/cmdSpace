import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceDragOverlays.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceDragOverlays contract", () => {
  it("renders the workspace reorder preview", () => {
    expect(source).toContain("WorkspaceDragOverlays");
    expect(source).toContain("draggedWorkspace");
    expect(source).not.toContain("draggedTerminal");
    expect(source).not.toContain("terminalDragVisual");
  });
});
