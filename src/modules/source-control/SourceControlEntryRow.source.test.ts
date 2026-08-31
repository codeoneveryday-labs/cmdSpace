import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./SourceControlEntryRow.tsx", import.meta.url),
  "utf8",
);

describe("SourceControlEntryRow contract", () => {
  it("keeps file selection, staging and discard actions in the row seam", () => {
    expect(source).toContain("export const SourceControlEntryRow");
    expect(source).toContain("onSelectFile(entry)");
    expect(source).toContain("onToggleStageFile(entry)");
    expect(source).toContain("onDiscardFile(entry)");
    expect(source).toContain("Stage ${entry.path}");
    expect(source).toContain("Discard ${entry.path}");
  });
});
