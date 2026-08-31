import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useFileExplorerNativeDrop.ts", import.meta.url),
  "utf8",
);

describe("useFileExplorerNativeDrop contract", () => {
  it("owns native listener cleanup and drop import routing", () => {
    expect(source).toContain("onDragDropEvent");
    expect(source).toContain("resolveDestination");
    expect(source).toContain("importPaths(payload.paths");
    expect(source).toContain("unlisten?.()");
  });
});
