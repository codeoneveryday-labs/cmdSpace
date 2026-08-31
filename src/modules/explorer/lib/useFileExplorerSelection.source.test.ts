import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useFileExplorerSelection.ts", import.meta.url),
  "utf8",
);

describe("useFileExplorerSelection contract", () => {
  it("composes the extracted selection-state policy and still exposes reset behavior", () => {
    expect(source).toContain("fileExplorerSelectionState");
    expect(source).toContain("pruneFileExplorerSelectionState");
    expect(source).toContain("resetFileExplorerSelectionState");
    expect(source).toContain("selectFileExplorerPath");
    expect(source).toContain("clearSelection");
  });
});
