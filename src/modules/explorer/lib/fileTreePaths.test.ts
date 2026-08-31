import { describe, expect, it } from "vitest";

import { dirname, joinPath } from "./fileTreePaths";

describe("file tree paths", () => {
  it("joins a child without duplicating a root separator", () => {
    expect(joinPath("/repo", "file.ts")).toBe("/repo/file.ts");
    expect(joinPath("/repo/", "file.ts")).toBe("/repo/file.ts");
  });

  it("finds a parent while preserving the filesystem root", () => {
    expect(dirname("/repo/file.ts")).toBe("/repo");
    expect(dirname("/file.ts")).toBe("/");
    expect(dirname("/repo")).toBe("/");
  });
});
