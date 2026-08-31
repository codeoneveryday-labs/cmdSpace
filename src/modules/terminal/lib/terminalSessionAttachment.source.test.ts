import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalSessionAttachment.ts", import.meta.url),
  "utf8",
);

describe("terminalSessionAttachment contract", () => {
  it("owns slot snapshot capture and detached-session cleanup", () => {
    expect(source).toContain("unbindTerminalSessionFromSlot");
    expect(source).toContain("detachTerminalSession");
    expect(source).toContain("releaseSlot");
    expect(source).toContain("altScreenAtRelease");
    expect(source).toContain("callbacks = {}");
    expect(source).toContain("container = null");
  });
});
