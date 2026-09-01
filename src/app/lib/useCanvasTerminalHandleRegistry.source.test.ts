import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasTerminalHandleRegistry.ts", import.meta.url),
  "utf8",
);

describe("useCanvasTerminalHandleRegistry contract", () => {
  it("keeps canvas handles keyed and signals active-terminal changes", () => {
    expect(source).toContain("useCanvasTerminalHandleRegistry");
    expect(source).toContain("refKey(tabId, terminalId)");
    expect(source).toContain("canvasTerminalRefs.current.set");
    expect(source).toContain("canvasTerminalRefs.current.delete");
    expect(source).toContain("activeCanvasTerminalIds.current.set");
    expect(source).toContain("activeCanvasTerminalIds.current.delete");
    expect(source).toContain("setSelectionVersion((version) => version + 1)");
  });
});
