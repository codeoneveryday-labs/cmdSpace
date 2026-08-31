import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./sourceControlEntriesModel.ts", import.meta.url),
  "utf8",
);

describe("sourceControlEntriesModel contract", () => {
  it("owns grouped rows, merged file rows, and header checkbox derivation", () => {
    expect(source).toContain("buildSourceControlEntries");
    expect(source).toContain("SourceControlFileEntry");
    expect(source).toContain("headerCheckState");
    expect(source).not.toContain("useState");
    expect(source).not.toContain("native.git");
  });
});
