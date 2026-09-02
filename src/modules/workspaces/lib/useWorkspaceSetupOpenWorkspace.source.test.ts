import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSetupOpenWorkspace.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSetupOpenWorkspace contract", () => {
  it("owns workspace payload assembly without owning the workspace state", () => {
    expect(source).toContain("useWorkspaceSetupOpenWorkspace");
    expect(source).toContain("selectedWorkspaceAgents");
    expect(source).toContain("selectedImportSessions.map");
    expect(source).toContain("onOpenWithoutAi");
    expect(source).toContain("buildWorkspaceLaunchCommands");
    expect(source).toContain("launchCommands");
    expect(source).toContain("latest.current");
    expect(source).toContain("onCancel");
    expect(source).not.toContain("invoke(");
  });
});
