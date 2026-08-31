import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./fileExplorerRows.ts", import.meta.url), "utf8");

describe("fileExplorerRows contract", () => {
  it("keeps tree flattening independent from UI and IPC", () => {
    expect(source).toContain("buildRows");
    expect(source).toContain("entryIndexByPath");
    expect(source).not.toContain("useState");
    expect(source).not.toContain("invoke(");
  });
});
