import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasDeleteShortcut.ts", import.meta.url),
  "utf8",
);

describe("useCanvasDeleteShortcut contract", () => {
  it("guards editable targets and dispatches node or edge deletion", () => {
    expect(source).toContain("export function useCanvasDeleteShortcut");
    expect(source).toContain('event.key !== "Delete" && event.key !== "Backspace"');
    expect(source).toContain("isEditableShortcutTarget(event.target)");
    expect(source).toContain("removeSelectedNode();");
    expect(source).toContain("removeSelectedEdge();");
    expect(source).toContain('window.addEventListener("keydown", handleDeleteKey)');
  });
});
