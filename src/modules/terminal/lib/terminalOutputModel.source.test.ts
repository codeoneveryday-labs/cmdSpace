import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalOutputModel.ts", import.meta.url),
  "utf8",
);

describe("terminalOutputModel contract", () => {
  it("keeps output classification pure", () => {
    expect(source).toContain("export function processTerminalOutput");
    expect(source).toContain("detectCodingAgentBanner");
    expect(source).toContain("detectAgentSpinnerState");
    expect(source).not.toContain("writeToPty");
    expect(source).not.toContain("setAgentResponseActivity");
    expect(source).not.toContain("window.");
  });
});
