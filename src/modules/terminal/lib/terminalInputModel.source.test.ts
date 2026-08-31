import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalInputModel.ts", import.meta.url),
  "utf8",
);

describe("terminalInputModel contract", () => {
  it("keeps replacement policy independent from PTY/session ownership", () => {
    expect(source).toContain("export function replaceUntouchedTerminalInput");
    expect(source).toContain("export function replaceCurrentTerminalInput");
    expect(source).toContain('write("\\u0015")');
    expect(source).toContain("state.inputBuffer !== expected");
    expect(source).toContain("state.interactiveCodingAgent");
  });
});
