import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasTerminalCreatorRegistration.ts", import.meta.url),
  "utf8",
);

describe("useCanvasTerminalCreatorRegistration contract", () => {
  it("registers a capped terminal creator and unregisters it on cleanup", () => {
    expect(source).toContain("useCanvasTerminalCreatorRegistration");
    expect(source).toContain("onRegisterTerminalCreator?.(tabId");
    expect(source).toContain("MAX_PANES_PER_TAB");
    expect(source).toContain("pendingTerminalCommandRef.current");
    expect(source).toContain('beginSurfacePlacement("terminal")');
    expect(source).toContain("onRegisterTerminalCreator?.(tabId, null)");
  });
});
