import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./SourceControlDiscardDialog.tsx", import.meta.url),
  "utf8",
);

describe("SourceControlDiscardDialog contract", () => {
  it("keeps pending discard confirmation and cancellation in one seam", () => {
    expect(source).toContain("export function SourceControlDiscardDialog");
    expect(source).toContain("Discard changes?");
    expect(source).toContain("cannot be undone");
    expect(source).toContain("onConfirm");
    expect(source).toContain("onCancel");
  });
});
