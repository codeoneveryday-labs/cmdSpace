import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "WorkspaceSetupAgentsStep.tsx",
);

describe("WorkspaceSetupAgentsStep", () => {
  it("composes assignment, agent selection, and session import surfaces", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("WorkspaceAgentAssignmentSummary");
    expect(source).toContain("WorkspaceAgentSelectionGrid");
    expect(source).toContain("ImportSessionDialog");
    expect(source).not.toContain("useState(");
    expect(source).not.toContain("invoke(");
  });
});
