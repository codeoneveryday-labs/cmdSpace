import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceAgentSelectionGrid.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceAgentSelectionGrid contract", () => {
  it("owns agent terminal selection and command editing", () => {
    expect(source).toContain("export function WorkspaceAgentSelectionGrid");
    expect(source).toContain("Toggle ${agent.name}");
    expect(source).toContain("Custom agent CLI command");
    expect(source).toContain("persistAgentCommand");
    expect(source).toContain("persistCustomCommand");
    expect(source).not.toContain("invoke(");
  });
});
