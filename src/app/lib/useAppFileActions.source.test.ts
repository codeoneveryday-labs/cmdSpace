import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppFileActions.ts", import.meta.url),
  "utf8",
);

describe("useAppFileActions contract", () => {
  it("routes file open, rename and deletion through explicit tab ports", () => {
    expect(source).toContain("useAppFileActions");
    expect(source).toContain("openFileTab(path, pin ?? false)");
    expect(source).toContain("editorPathPatches");
    expect(source).toContain("partitionDeletedEditorTabs");
    expect(source).toContain("for (const id of clean) disposeTab(id)");
    expect(source).toContain("setPendingDeleteTabs(dirty)");
  });
});
