import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSetupStateGuards.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSetupStateGuards contract", () => {
  it("keeps imported-session and custom-agent state bounded", () => {
    expect(source).toContain("useWorkspaceSetupStateGuards");
    expect(source).toContain("terminalCount");
    expect(source).toContain("setSelectedImportSessions");
    expect(source).toContain("setAgentCounts");
    expect(source).toContain("customCommand.trim()");
  });
});
