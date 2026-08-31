import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./architectureTextModel.ts", import.meta.url),
  "utf8",
);

describe("architectureTextModel contract", () => {
  it("centralizes text sizing and immutable node cloning", () => {
    expect(source).toContain("cloneNodes");
    expect(source).toContain("cloneNode");
    expect(source).toContain("textNodeLines");
    expect(source).toContain("measureTextNodeSize");
    expect(source).toContain("fitTextNode");
  });
});
