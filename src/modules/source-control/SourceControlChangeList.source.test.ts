import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./SourceControlChangeList.tsx", import.meta.url),
  "utf8",
);

describe("SourceControlChangeList contract", () => {
  it("owns virtualized changes rendering and keyboard staging navigation", () => {
    expect(source).toContain("export function SourceControlChangeList");
    expect(source).toContain("useVirtualizer");
    expect(source).toContain("ArrowDown");
    expect(source).toContain("onToggleStageFile");
    expect(source).toContain("aria-activedescendant");
  });
});
