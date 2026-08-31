import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalInputTrackingModel.ts", import.meta.url),
  "utf8",
);

describe("terminalInputTrackingModel contract", () => {
  it("owns prompt buffers and emits explicit lifecycle events", () => {
    expect(source).toContain("export function trackTerminalInput");
    expect(source).toContain("agent-response-requested");
    expect(source).toContain("command-submitted");
    expect(source).toContain("function updateBuffer");
    expect(source).not.toContain("writeToSessionPty");
    expect(source).not.toContain("setAgentResponseActivity");
  });
});
