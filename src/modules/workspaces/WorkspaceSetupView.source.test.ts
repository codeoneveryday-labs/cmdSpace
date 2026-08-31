import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = [
  readFileSync(new URL("./WorkspaceSetupView.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./WorkspaceSetupLayoutStep.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./WorkspaceAgentSelectionGrid.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./WorkspaceAgentAssignmentSummary.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./WorkspaceSetupFooter.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./WorkspaceForkSetup.tsx", import.meta.url), "utf8"),
  readFileSync(
    new URL("./lib/useWorkspaceSetupAgentCapacity.ts", import.meta.url),
    "utf8",
  ),
  readFileSync(
    new URL("./lib/useWorkspaceSetupCommandPersistence.ts", import.meta.url),
    "utf8",
  ),
  readFileSync(new URL("./lib/useWorkspaceSetupFolder.ts", import.meta.url), "utf8"),
  readFileSync(
    new URL("./lib/useWorkspaceSetupKeyboardShortcuts.ts", import.meta.url),
    "utf8",
  ),
  readFileSync(
    new URL("./lib/useWorkspaceSetupOpenWorkspace.ts", import.meta.url),
    "utf8",
  ),
  readFileSync(
    new URL("./lib/useWorkspaceSetupAgentSelectionSync.ts", import.meta.url),
    "utf8",
  ),
  readFileSync(
    new URL("./lib/useWorkspaceSetupImportSelection.ts", import.meta.url),
    "utf8",
  ),
  readFileSync(
    new URL("./lib/useWorkspaceSetupIdentitySync.ts", import.meta.url),
    "utf8",
  ),
  readFileSync(new URL("./lib/workspaceSetupModel.ts", import.meta.url), "utf8"),
].join("\n");

describe("WorkspaceSetupView contract", () => {
  it("keeps folder, layout, agent and import-session setup in one feature seam", () => {
    expect(source).toContain("export function WorkspaceSetupView");
    expect(source).toContain("resolveFolderCommand");
    expect(source).toContain("WORKSPACE_SETUP_PRESETS");
    expect(source).toContain("regularTerminalCount");
    expect(source).toContain("selectImportSessions");
    expect(source).toContain("onOpenWithoutAi");
  });
});
