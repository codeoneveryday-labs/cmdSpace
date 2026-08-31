import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasBrowserLayerActions.ts", import.meta.url),
  "utf8",
);

describe("useCanvasBrowserLayerActions contract", () => {
  it("keeps browser URL, tab and group action policy behind a port", () => {
    expect(source).toContain("export function useCanvasBrowserLayerActions");
    expect(source).toContain("new URL(url)");
    expect(source).toContain("onRequestCloseTab");
    expect(source).toContain("onToggleGroupLock");
    expect(source).toContain("onRequestCloseGroup");
  });
});
