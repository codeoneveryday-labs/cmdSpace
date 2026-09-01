import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./workspaceNavigationModel.ts", import.meta.url), "utf8");

describe("workspaceNavigationModel contract", () => {
  it("keeps workspace shortcut transition pure", () => {
    expect(source).toContain("nextWorkspaceIndex");
    expect(source).toContain("% length");
    expect(source).not.toContain("setActiveId");
    expect(source).not.toContain("useState");
  });
});
