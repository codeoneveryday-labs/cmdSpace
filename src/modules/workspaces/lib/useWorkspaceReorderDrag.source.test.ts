import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceReorderDrag.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceReorderDrag contract", () => {
  it("owns workspace row pointer lifecycle and reorder placement", () => {
    expect(source).toContain("useWorkspaceReorderDrag");
    expect(source).toContain("previewIndexForPointer");
    expect(source).toContain('"before"');
    expect(source).toContain('"after"');
    expect(source).toContain("pointercancel");
  });
});
