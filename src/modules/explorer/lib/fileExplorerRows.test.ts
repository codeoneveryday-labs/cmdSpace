import { describe, expect, it } from "vitest";
import { buildRows } from "./fileExplorerRows";

const tree = {
  nodes: {
    "/repo": {
      status: "loaded",
      entries: [
        { name: "src", kind: "dir" },
        { name: "README.md", kind: "file" },
      ],
    },
    "/repo/src": {
      status: "loaded",
      entries: [{ name: "App.tsx", kind: "file" }],
    },
  },
  expanded: new Set(["/repo/src"]),
  renaming: null,
  pendingCreate: null,
  joinPath: (parent: string, name: string) => `${parent}/${name}`,
} as unknown as Parameters<typeof buildRows>[1];

describe("fileExplorerRows", () => {
  it("flattens loaded entries and records selectable row indexes", () => {
    const result = buildRows("/repo", tree);

    expect(result.rows.map((row) => "path" in row ? row.path : row.kind)).toEqual([
      "/repo/src",
      "/repo/src/App.tsx",
      "/repo/README.md",
    ]);
    expect(result.entryIndexByPath.get("/repo/src/App.tsx")).toBe(1);
  });

  it("renders loading/error/pending placeholders for expanded folders", () => {
    const result = buildRows("/repo", {
      ...tree,
      nodes: {
        ...tree.nodes,
        "/repo/src": { status: "loading" },
      },
      pendingCreate: { parentPath: "/repo/src", kind: "file" },
    });

    expect(result.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "pending", pendingKind: "file" }),
      expect.objectContaining({ kind: "status", tone: "muted" }),
    ]));
  });
});
