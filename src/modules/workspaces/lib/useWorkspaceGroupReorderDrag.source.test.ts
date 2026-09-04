import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceGroupReorderDrag.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceGroupReorderDrag contract", () => {
  it("owns directory drag-handle lifecycle and group placement", () => {
    expect(source).toContain("useWorkspaceGroupReorderDrag");
    expect(source).toContain("data-workspace-group-id");
    expect(source).toContain("pointercancel");
    expect(source).toContain('"before"');
    expect(source).toContain('"after"');
    expect(source).toContain("onReorderGroup");
  });
});
