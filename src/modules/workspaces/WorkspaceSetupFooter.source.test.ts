import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceSetupFooter.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceSetupFooter contract", () => {
  it("keeps setup navigation and launch gates in a presentational seam", () => {
    expect(source).toContain("export function WorkspaceSetupFooter");
    expect(source).toContain("Open without AI");
    expect(source).toContain("Open agent chat");
    expect(source).toContain("plannedAgentCommands.length === 0");
    expect(source).not.toContain("invoke(");
  });
});
