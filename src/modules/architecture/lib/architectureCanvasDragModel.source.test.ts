import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./architectureCanvasDragModel.ts", import.meta.url),
  "utf8",
);

describe("architectureCanvasDragModel contract", () => {
  it("centralizes bounded node movement and attached terminal movement", () => {
    expect(source).toContain("resolveCanvasDragMove");
    expect(source).toContain("applyCanvasDragMove");
    expect(source).toContain("updateDraggedNodes");
    expect(source).toContain("draggedNodeAtPoint");
    expect(source).toContain("attachedTerminalGroupIdsForFrameMove");
    expect(source).toContain("isFrameAttachableKind");
  });
});
