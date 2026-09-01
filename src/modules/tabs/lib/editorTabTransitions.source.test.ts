import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editorTabTransitions.ts", import.meta.url), "utf8");

describe("editorTabTransitions contract", () => {
  it("owns persistent/preview dedupe and slot replacement", () => {
    expect(source).toContain("openEditorTabState");
    expect(source).toContain("existingPreview");
    expect(source).toContain("previewIndex");
    expect(source).toContain("preview: false");
  });
});
