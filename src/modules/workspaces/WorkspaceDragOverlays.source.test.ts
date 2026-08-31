import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceDragOverlays.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceDragOverlays contract", () => {
  it("renders terminal and workspace drag previews through document.body portals", () => {
    expect(source).toContain("WorkspaceDragOverlays");
    expect(source).toContain("createPortal");
    expect(source).toContain("document.body");
    expect(source).toContain("draggedTerminal");
    expect(source).toContain("draggedWorkspace");
  });
});
