import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasNodeActions.ts", import.meta.url),
  "utf8",
);

describe("useCanvasNodeActions contract", () => {
  it("keeps node and edge lifecycle policy behind one seam", () => {
    expect(source).toContain("export function useCanvasNodeActions");
    expect(source).toContain("removeTerminalFromDock");
    expect(source).toContain("selectedNodeIds");
    expect(source).toContain("setConnectSourceId(null)");
    expect(source).toContain("item.locked");
    expect(source).toContain("existing");
  });
});
