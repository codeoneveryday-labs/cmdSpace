import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./fileDropModel.ts", import.meta.url), "utf8");

describe("fileDropModel contract", () => {
  it("keeps destination fallback independent from DOM and filesystem effects", () => {
    expect(source).toContain("resolveDropDestination");
    expect(source).toContain("focusedPath");
    expect(source).toContain('from "./fileTreePaths"');
    expect(source).not.toContain('from "./useFileTree"');
    expect(source).not.toContain("document.");
    expect(source).not.toContain("movePaths");
  });
});
