import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppPaneActions.ts", import.meta.url),
  "utf8",
);

describe("useAppPaneActions contract", () => {
  it("coordinates split, close and maximize behavior at the app boundary", () => {
    expect(source).toContain("useAppPaneActions");
    expect(source).toContain("persistSplitPaneTree");
    expect(source).toContain("closeActivePane");
    expect(source).toContain("handleClose");
    expect(source).toContain("toggleMaximizePane");
  });
});
