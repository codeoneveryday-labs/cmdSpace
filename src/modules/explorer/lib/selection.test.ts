import { describe, expect, it } from "vitest";
import { getSelectionRange, removeDescendants } from "./selection";

describe("explorer selection", () => {
  it("returns the inclusive visible range between anchor and focus", () => {
    const paths = ["/repo/a", "/repo/b", "/repo/c", "/repo/d"];

    expect(getSelectionRange(paths, "/repo/c", "/repo/a")).toEqual([
      "/repo/a",
      "/repo/b",
      "/repo/c",
    ]);
  });

  it("keeps a single path when the anchor is not visible", () => {
    expect(getSelectionRange(["/repo/a", "/repo/b"], "/repo/hidden", "/repo/b")).toEqual([
      "/repo/b",
    ]);
  });

  it("removes selected descendants when their selected parent is deleted", () => {
    expect(
      removeDescendants([
        "/repo/src",
        "/repo/src/app.ts",
        "/repo/src/lib",
        "/repo/src/lib/util.ts",
        "/repo/README.md",
      ]),
    ).toEqual(["/repo/src", "/repo/README.md"]);
  });
});
