import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasTextEditing.ts", import.meta.url),
  "utf8",
);

describe("useCanvasTextEditing contract", () => {
  it("owns text creation, editing, fitting and editable-target guards", () => {
    expect(source).toContain("export function useCanvasTextEditing");
    expect(source).toContain("handleCanvasDoubleClick");
    expect(source).toContain("handleNodeDoubleClick");
    expect(source).toContain("fitTextNode");
    expect(source).toContain("isEditableShortcutTarget(event.target)");
    expect(source).toContain('setEditingTextId(created.id)');
  });
});
