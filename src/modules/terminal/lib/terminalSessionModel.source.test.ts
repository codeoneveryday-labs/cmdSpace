import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalSessionModel.ts", import.meta.url),
  "utf8",
);

describe("terminalSessionModel contract", () => {
  it("centralizes the session state contract and initialization defaults", () => {
    expect(source).toContain("TerminalSession");
    expect(source).toContain("createTerminalSession");
    expect(source).toContain("dormantRing");
    expect(source).toContain("agentResponseRequested");
    expect(source).toContain("ready: Promise.resolve()");
  });
});
