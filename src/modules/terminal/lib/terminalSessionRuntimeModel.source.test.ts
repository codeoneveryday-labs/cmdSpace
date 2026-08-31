import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalSessionRuntimeModel.ts", import.meta.url),
  "utf8",
);

describe("terminalSessionRuntimeModel contract", () => {
  it("centralizes respawn preparation without opening or closing a PTY", () => {
    expect(source).toContain("prepareTerminalSessionRespawn");
    expect(source).toContain("relaunchInitialCommand");
    expect(source).toContain("dormantRing");
    expect(source).toContain("shellExited = false");
    expect(source).not.toContain("openPty");
    expect(source).not.toContain("close()");
  });
});
