import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppSearchTarget.ts", import.meta.url),
  "utf8",
);

describe("useAppSearchTarget contract", () => {
  it("selects terminal, editor or Git History search targets with focus ports", () => {
    expect(source).toContain("useAppSearchTarget");
    expect(source).toContain('kind: "terminal"');
    expect(source).toContain('kind: "editor"');
    expect(source).toContain('kind: "git-history"');
    expect(source).toContain("terminalRefs.get(activeLeafId)?.focus()");
    expect(source).toContain("activeEditorHandle.focus()");
    expect(source).toContain("useMemo<SearchTarget>");
  });
});
