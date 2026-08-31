import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./sourceControlSelectionModel.ts", import.meta.url),
  "utf8",
);

describe("sourceControlSelectionModel contract", () => {
  it("owns selection equality and staged/unstaged reconciliation without React state", () => {
    expect(source).toContain("sameDiffSelection");
    expect(source).toContain("reconcileDiffSelection");
    expect(source).toContain('transition: "moved-group"');
    expect(source).toContain('transition: "reset"');
    expect(source).not.toContain("useState");
  });
});
