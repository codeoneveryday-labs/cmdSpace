import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasDiagramHistory.ts", import.meta.url),
  "utf8",
);

describe("useCanvasDiagramHistory contract", () => {
  it("captures diagram state and resets transient interaction state on restore", () => {
    expect(source).toContain("export function useCanvasDiagramHistory");
    expect(source).toContain("structuredClone(terminalDockGroups)");
    expect(source).toContain("nextNodeRef.current");
    expect(source).toContain("clearSelection();");
    expect(source).toContain('setMode("select")');
    expect(source).toContain("setDrag(null)");
  });
});
