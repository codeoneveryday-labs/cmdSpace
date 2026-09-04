import { describe, expect, it } from "vitest";
import { applyTabPatch } from "./tabPatchModel";
import type { EditorTab, MarkdownTab } from "./tabTypes";

describe("tabPatchModel", () => {
  it("updates markdown titles when supplied", () => {
    const tab: MarkdownTab = { id: 1, kind: "markdown", title: "old", path: "/old.md" };
    expect(applyTabPatch(tab, { title: "new" })).toMatchObject({
      title: "new",
    });
  });

  it("auto-promotes a preview editor when it becomes dirty", () => {
    const tab: EditorTab = { id: 1, kind: "editor", title: "README.md", path: "README.md", dirty: false, preview: true };
    expect(applyTabPatch(tab, { dirty: true })).toMatchObject({ dirty: true, preview: false });
  });
});
