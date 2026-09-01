import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./paneNavigationModel.ts", import.meta.url),
  "utf8",
);

describe("paneNavigationModel contract", () => {
  it("keeps directional selection independent from the DOM", () => {
    expect(source).toContain("export function selectDirectionalPane");
    expect(source).toContain("primaryDistance + 3 * secondaryDistance");
    expect(source).not.toContain("document.");
    expect(source).not.toContain("focusPane");
  });
});
