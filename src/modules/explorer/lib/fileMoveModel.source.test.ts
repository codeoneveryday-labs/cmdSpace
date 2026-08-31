import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./fileMoveModel.ts", import.meta.url), "utf8");

describe("fileMoveModel contract", () => {
  it("keeps move preparation independent from DOM and filesystem effects", () => {
    expect(source).toContain("prepareMovePaths");
    expect(source).toContain("removeDescendants");
    expect(source).toContain("canMovePathsTo");
    expect(source).not.toContain("movePaths");
    expect(source).not.toContain("document.");
  });
});
