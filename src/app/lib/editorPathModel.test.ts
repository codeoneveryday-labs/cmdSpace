import { describe, expect, it } from "vitest";
import { editorPathPatches, partitionDeletedEditorTabs } from "./editorPathModel";

const editor = (id: number, path: string, dirty = false) =>
  ({ id, kind: "editor", path, title: path.split("/").pop(), dirty, preview: false }) as never;

describe("editorPathModel", () => {
  it("renames a file and all editor descendants of a directory", () => {
    expect(editorPathPatches(
      [editor(1, "/repo/old.md"), editor(2, "/repo/old/nested.ts"), editor(3, "/repo/other.ts")],
      "/repo/old",
      "/repo/new",
    )).toEqual([{ id: 2, path: "/repo/new/nested.ts", title: "nested.ts" }]);
  });

  it("partitions deleted editor tabs into dirty and clean sets", () => {
    expect(partitionDeletedEditorTabs(
      [editor(1, "/repo/file.ts", true), editor(2, "/repo/dir/a.ts"), editor(3, "/repo/else.ts")],
      "/repo/dir",
    )).toEqual({ dirty: [], clean: [2] });
  });
});
