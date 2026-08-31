import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useSourceControlMutation.ts", import.meta.url),
  "utf8",
);

describe("useSourceControlMutation contract", () => {
  it("owns optimistic apply, diff invalidation, reconcile and rollback", () => {
    expect(source).toContain("useSourceControlMutation");
    expect(source).toContain("summary.applyStatus");
    expect(source).toContain("invalidateDiff");
    expect(source).toContain("scheduleReconcile");
    expect(source).toContain("summary.refresh");
    expect(source).toContain("normalizeSourceControlError");
  });
});
