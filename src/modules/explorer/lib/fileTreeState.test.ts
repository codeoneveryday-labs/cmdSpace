import { describe, expect, it } from "vitest";

import { emptyFileTreeState, loadedDirectoryPaths } from "./fileTreeState";

describe("file tree state policy", () => {
  it("resets every root-scoped interaction state without sharing expanded paths", () => {
    const first = emptyFileTreeState();
    first.expanded.add("/old-root/src");
    const next = emptyFileTreeState();

    expect(next).toEqual({
      nodes: {},
      expanded: new Set(),
      pendingCreate: null,
      renaming: null,
    });
    expect(next.expanded).not.toBe(first.expanded);
  });

  it("refetches only directories whose current entries were loaded", () => {
    expect(
      loadedDirectoryPaths({
        "/repo/loading": { status: "loading" },
        "/repo/failed": { status: "error", message: "no access" },
        "/repo/src": { status: "loaded", entries: [] },
      }),
    ).toEqual(["/repo/src"]);
  });
});
