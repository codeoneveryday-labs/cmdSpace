import { describe, expect, it } from "vitest";
import {
  filterExcludedFolders,
  normalizeExcludedFolderNames,
  parseExcludedFolderNames,
} from "./excludedFolders";

describe("Explorer excluded folders", () => {
  it("normalizes names while preserving their first-seen order", () => {
    expect(
      normalizeExcludedFolderNames([
        " .git ",
        "node_modules",
        "",
        ".git",
        "target",
      ]),
    ).toEqual([".git", "node_modules", "target"]);
  });

  it("parses comma and newline separated input", () => {
    expect(
      parseExcludedFolderNames(".git, node_modules\ndist, , target"),
    ).toEqual([".git", "node_modules", "dist", "target"]);
  });

  it("filters exact directory basenames without hiding files", () => {
    const entries = [
      { name: ".git", kind: "dir" },
      { name: "node_modules", kind: "dir" },
      { name: "node_modules-old", kind: "dir" },
      { name: "node_modules", kind: "file" },
      { name: "src", kind: "dir" },
    ] as const;

    expect(
      filterExcludedFolders(entries, [".git", "node_modules"]),
    ).toEqual([
      { name: "node_modules-old", kind: "dir" },
      { name: "node_modules", kind: "file" },
      { name: "src", kind: "dir" },
    ]);
  });
});
