import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editorPathModel.ts", import.meta.url), "utf8");

describe("editorPathModel contract", () => {
  it("keeps editor path policy free of React and side effects", () => {
    expect(source).toContain("editorPathPatches");
    expect(source).toContain("partitionDeletedEditorTabs");
    expect(source).not.toContain("useState");
    expect(source).not.toContain("disposeTab");
  });
});
