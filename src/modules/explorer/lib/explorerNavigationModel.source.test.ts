import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./explorerNavigationModel.ts", import.meta.url), "utf8");

describe("explorerNavigationModel contract", () => {
  it("keeps keyboard action decisions free of UI side effects", () => {
    expect(source).toContain("resolveExplorerNavigation");
    expect(source).toContain("ArrowRight");
    expect(source).toContain("ArrowLeft");
    expect(source).not.toContain("tree.toggle");
    expect(source).not.toContain("requestAnimationFrame");
  });
});
