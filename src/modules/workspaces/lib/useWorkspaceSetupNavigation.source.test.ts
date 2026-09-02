import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSetupNavigation.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSetupNavigation contract", () => {
  it("owns setup back and primary launch gating", () => {
    expect(source).toContain("useWorkspaceSetupNavigation");
    expect(source).toContain('setupStep === "agents"');
    expect(source).toContain("plannedAgentCommands");
    expect(source).toContain("selectedChatAgent");
    expect(source).toContain("openWorkspace");
    expect(source).toContain("plannedAgentCommands.length > 0");
    expect(source).toContain("openWorkspace()");
  });
});
