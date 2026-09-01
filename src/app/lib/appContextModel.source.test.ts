import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./appContextModel.ts", import.meta.url), "utf8");

describe("appContextModel contract", () => {
  it("keeps tab context resolution pure", () => {
    expect(source).toContain("resolveActiveFilePath");
    expect(source).toContain("resolveSourceControlContextPath");
    expect(source).not.toContain("invoke(");
    expect(source).not.toContain("useState");
  });
});
