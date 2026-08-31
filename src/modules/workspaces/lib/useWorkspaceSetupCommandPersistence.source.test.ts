import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSetupCommandPersistence.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSetupCommandPersistence contract", () => {
  it("owns custom-command hydration and launch-command persistence", () => {
    expect(source).toContain("useWorkspaceSetupCommandPersistence");
    expect(source).toContain("db_load_workspace_setup_custom_command");
    expect(source).toContain("db_save_workspace_setup_custom_command");
    expect(source).toContain("setAgentLaunchCommands");
    expect(source).toContain("window.setTimeout");
  });
});
