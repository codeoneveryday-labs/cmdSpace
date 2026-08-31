import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = [
  readFileSync(new URL("./WorkspaceSetupLayoutStep.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./lib/workspaceSetupModel.ts", import.meta.url), "utf8"),
].join("\n");

describe("WorkspaceSetupLayoutStep contract", () => {
  it("owns the first setup step without moving persistence into the view", () => {
    expect(source).toContain("export function WorkspaceSetupLayoutStep");
    expect(source).toContain("Workspace name");
    expect(source).toContain("Workspace mode");
    expect(source).toContain("Working folder");
    expect(source).toContain("WORKSPACE_SETUP_PRESETS");
    expect(source).toContain("setTerminalCount(preset.count)");
    expect(source).toContain("resolveFolderCommand");
    expect(source).not.toContain("invoke<");
    expect(source).not.toContain("db_save_workspace");
  });
});
