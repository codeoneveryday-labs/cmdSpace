import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useEditorExternalReload.ts", import.meta.url),
  "utf8",
);

describe("useEditorExternalReload contract", () => {
  it("deduplicates approved diffs and cleans up external file listeners", () => {
    expect(source).toContain("appliedDiffsRef");
    expect(source).toContain('"fs:file-written"');
    expect(source).toContain("source === \"editor\"");
    expect(source).toContain("unlistenPromise.then");
    expect(source).toContain("replace(/\\\\/g, \"/\")");
  });
});
