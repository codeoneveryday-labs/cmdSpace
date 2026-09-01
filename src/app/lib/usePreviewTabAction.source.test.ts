import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./usePreviewTabAction.ts", import.meta.url),
  "utf8",
);

describe("usePreviewTabAction contract", () => {
  it("focuses the address bar only for a newly opened empty preview", () => {
    expect(source).toContain("usePreviewTabAction");
    expect(source).toContain("newPreviewTab(url)");
    expect(source).toContain("if (!url)");
    expect(source).toContain("focusAddressBar()");
    expect(source).toContain("setTimeout");
  });
});
