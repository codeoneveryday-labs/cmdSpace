import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceSetupOrchestratorSelection.tsx", import.meta.url),
  "utf8",
);

describe("orchestrator setup selection contract", () => {
  it("makes the coordinator a single explicit CLI choice with recommendations", () => {
    expect(source).toContain("Select the orchestrator");
    expect(source).toContain("agent.id === \"codex\" || agent.id === \"claude\"");
    expect(source).toContain("Recommended");
    expect(source).toContain("aria-pressed");
  });
});
