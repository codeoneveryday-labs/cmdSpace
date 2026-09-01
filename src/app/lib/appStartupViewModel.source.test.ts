import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./appStartupViewModel.ts", import.meta.url),
  "utf8",
);

describe("appStartupViewModel contract", () => {
  it("centralizes bootstrap suppression and workspace loading presentation", () => {
    expect(source).toContain("getAppStartupView");
    expect(source).toContain("shouldSuppressBootstrapShell");
    expect(source).toContain("getWorkspaceLoadingPresentation");
    expect(source).toContain("Opening workspace");
  });
});
