import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "useCanvasSelection.ts",
  ),
  "utf8",
);

describe("useCanvasSelection contract", () => {
  it("keeps node and edge selection mutually exclusive", () => {
    expect(source).toContain("const selectSingleNode");
    expect(source).toContain("const selectEdge");
    expect(source).toContain("setSelectedNodeIds([])");
    expect(source).toContain("const clearSelection");
  });
});
