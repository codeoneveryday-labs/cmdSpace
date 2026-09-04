import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./architectureNodeDefaults.ts", import.meta.url),
  "utf8",
);

describe("architectureNodeDefaults contract", () => {
  it("keeps technology labels centralized for all node kinds", () => {
    expect(source).toContain("defaultTechnology");
    expect(source).toContain('case "service"');
    expect(source).toContain('case "database"');
    expect(source).toContain('case "terminal"');
    expect(source).not.toContain('case "browser"');
  });
});
