import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasTerminalTabState.ts", import.meta.url),
  "utf8",
);

describe("useCanvasTerminalTabState contract", () => {
  it("owns active terminal reporting and tab activation/close transitions", () => {
    expect(source).toContain("useCanvasTerminalTabState");
    expect(source).toContain("onActiveTerminalChange");
    expect(source).toContain("activateTerminalTab");
    expect(source).toContain("closeTerminalTab");
    expect(source).toContain("resolveNextTerminalTabState");
  });
});
