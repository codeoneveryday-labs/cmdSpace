import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasUndoShortcut.ts", import.meta.url),
  "utf8",
);

describe("useCanvasUndoShortcut contract", () => {
  it("guards editable targets and only undoes when history exists", () => {
    expect(source).toContain("export function useCanvasUndoShortcut");
    expect(source).toContain("event.metaKey || event.ctrlKey");
    expect(source).toContain('event.key.toLowerCase() !== "z"');
    expect(source).toContain("isEditableShortcutTarget(event.target)");
    expect(source).toContain("if (!canUndo) return;");
    expect(source).toContain("undoCanvas();");
  });
});
