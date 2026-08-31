import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasTerminalLayerActions.ts", import.meta.url),
  "utf8",
);

describe("useCanvasTerminalLayerActions contract", () => {
  it("keeps terminal layer mutations behind an action port", () => {
    expect(source).toContain("export function useCanvasTerminalLayerActions");
    expect(source).toContain("onHandleChange");
    expect(source).toContain("onRequestCloseTab");
    expect(source).toContain("onToggleSurfaceGroupLock");
    expect(source).toContain("onDockDividerPointerDown");
  });
});
