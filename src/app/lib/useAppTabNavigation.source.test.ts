import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppTabNavigation.ts", import.meta.url),
  "utf8",
);

describe("useAppTabNavigation contract", () => {
  it("keeps tab cycling, creation and delayed cd focus behind tab ports", () => {
    expect(source).toContain("useAppTabNavigation");
    expect(source).toContain("cycleTab");
    expect(source).toContain("newTab(inheritedCwdForNewTab())");
    expect(source).toContain("newPrivateTab(inheritedCwdForNewTab())");
    expect(source).toContain("tabsRef.current.find");
    expect(source).toContain("terminal.write(`cd ${quoted}\\r`)");
    expect(source).toContain("terminal.focus()");
  });
});
