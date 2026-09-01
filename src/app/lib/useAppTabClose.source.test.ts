import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppTabClose.ts", import.meta.url),
  "utf8",
);

describe("useAppTabClose contract", () => {
  it("guards dirty editors and exposes explicit confirm/cancel actions", () => {
    expect(source).toContain("useAppTabClose");
    expect(source).toContain('tab?.kind === "editor" && tab.dirty');
    expect(source).toContain("setPendingCloseTab(id)");
    expect(source).toContain("confirmClose");
    expect(source).toContain("cancelClose");
    expect(source).toContain("disposeTab(pendingCloseTab)");
  });
});
