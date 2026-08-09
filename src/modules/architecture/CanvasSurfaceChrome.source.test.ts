import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const source = readFileSync(path.join(here, "CanvasSurfaceChrome.tsx"), "utf8");

describe("CanvasSurfaceChrome drag interaction", () => {
  it("starts a surface drag from non-button space in the title bar", () => {
    expect(source).toContain("const topBar =");
    expect(source).toContain(
      'if (topBar && !target.closest("button"))',
    );
    expect(source).toContain("onHeaderPointerDown(event)");
  });

  it("routes a tab drag separately from moving the whole surface group", () => {
    expect(source).toContain("onTabPointerDown: (");
    expect(source).toContain("onTabPointerDown(tab.id, event)");
    expect(source).not.toContain("if (tab.id === activeTabId)");
  });
});
