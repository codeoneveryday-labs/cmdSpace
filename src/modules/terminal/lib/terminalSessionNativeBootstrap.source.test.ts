import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalSessionRuntime.ts", import.meta.url),
  "utf8",
);

describe("terminal session native bootstrap", () => {
  it("passes every pane launch command to the native PTY bootstrap", () => {
    expect(source).toContain("cwd,\n    s.initialCommand,");
    expect(source).toContain("s.callbacks.onCommand?.(s.initialCommand)");
  });
});
