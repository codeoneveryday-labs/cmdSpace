import { describe, expect, it } from "vitest";
import { applyTabPatch } from "./tabPatchModel";
import type { EditorTab, PreviewTab } from "./tabTypes";

describe("tabPatchModel", () => {
  it("updates preview URLs and derives a title when none is supplied", () => {
    const tab: PreviewTab = { id: 1, kind: "preview", title: "old", url: "https://old.test" };
    expect(applyTabPatch(tab, { url: "https://new.test/path" })).toMatchObject({
      url: "https://new.test/path",
      title: "new.test",
    });
  });

  it("auto-promotes a preview editor when it becomes dirty", () => {
    const tab: EditorTab = { id: 1, kind: "editor", title: "README.md", path: "README.md", dirty: false, preview: true };
    expect(applyTabPatch(tab, { dirty: true })).toMatchObject({ dirty: true, preview: false });
  });
});
