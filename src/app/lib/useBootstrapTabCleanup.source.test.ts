import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useBootstrapTabCleanup.ts", import.meta.url),
  "utf8",
);

describe("useBootstrapTabCleanup contract", () => {
  it("closes only the temporary shell after workspace activation", () => {
    expect(source).toContain("useBootstrapTabCleanup");
    expect(source).toContain("pendingBootstrapCloseRef.current");
    expect(source).toContain('tab.id === 1 && tab.title === "shell"');
    expect(source).toContain("tabs.length > 1");
    expect(source).toContain("closeTab(bootstrapTab.id)");
    expect(source).toContain("pendingBootstrapCloseRef.current = false");
  });
});
