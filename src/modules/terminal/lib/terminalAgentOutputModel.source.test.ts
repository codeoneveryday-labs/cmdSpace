import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalAgentOutputModel.ts", import.meta.url),
  "utf8",
);

describe("terminalAgentOutputModel contract", () => {
  it("centralizes response-requested output state decisions", () => {
    expect(source).toContain("resolveAgentOutputActivity");
    expect(source).toContain('spinnerState === "blocked"');
    expect(source).toContain('spinnerState === "working"');
    expect(source).toContain("outputIsUserEcho");
    expect(source).not.toContain("setAgentResponseActivity");
  });
});
