import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./workspaceCreationModel.ts", import.meta.url), "utf8");

describe("workspaceCreationModel contract", () => {
  it("keeps workspace creation policy independent from app effects", () => {
    expect(source).toContain("buildCanvasWorkspaceDiagram");
    expect(source).toContain("nextWorkspaceName");
    expect(source).toContain("workspaceAccentForIndex");
    expect(source).not.toContain("invoke(");
    expect(source).not.toContain("useState");
  });
});
