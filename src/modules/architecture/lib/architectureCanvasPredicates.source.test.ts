import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./architectureCanvasPredicates.ts", import.meta.url),
  "utf8",
);

describe("architectureCanvasPredicates contract", () => {
  it("centralizes canvas kind and keyboard-target classification", () => {
    expect(source).toContain("isShapeDrawingMode");
    expect(source).toContain("isEditableShortcutTarget");
    expect(source).toContain("isCanvasNavBlockedTarget");
    expect(source).toContain("isLiveSurfaceKind");
    expect(source).toContain("isDrawingOnlyKind");
  });
});
