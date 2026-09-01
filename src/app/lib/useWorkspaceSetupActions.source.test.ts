import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSetupActions.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSetupActions contract", () => {
  it("assembles workspace creation ports and preserves the empty-workspace cancel guard", () => {
    expect(source).toContain("useWorkspaceSetupActions");
    expect(source).toContain("createWorkspace({");
    expect(source).toContain("tabs: [...tabsRef.current]");
    expect(source).toContain("nextWorkspaceName");
    expect(source).toContain("closeSetup");
    expect(source).toContain("workspacesHydrated && workspacesLength === 0");
    expect(source).toContain("setWorkspaceForkContext(null)");
  });
});
