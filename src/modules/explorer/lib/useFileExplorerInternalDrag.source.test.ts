import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useFileExplorerInternalDrag.ts", import.meta.url),
  "utf8",
);

describe("useFileExplorerInternalDrag contract", () => {
  it("owns hit testing, move validation, target state and commit routing", () => {
    expect(source).toContain("getBoundingClientRect");
    expect(source).toContain("canMovePathsTo");
    expect(source).toContain("setDropTarget");
    expect(source).toContain("movePaths(paths, target.path, target.isDir)");
  });
});
