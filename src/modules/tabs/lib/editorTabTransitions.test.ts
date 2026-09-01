import { describe, expect, it } from "vitest";
import type { Tab } from "./tabTypes";
import { openEditorTabState, promoteEditorTab } from "./editorTabTransitions";

const preview = { id: 1, kind: "editor", title: "old.ts", path: "/repo/old.ts", dirty: false, preview: true } as Tab;
const persistent = { id: 2, kind: "editor", title: "README.md", path: "/repo/README.md", dirty: false, preview: false } as Tab;

describe("editorTabTransitions", () => {
  it("promotes an existing preview for a pinned open", () => {
    const result = openEditorTabState([preview], "/repo/old.ts", true, () => 10);
    expect(result.targetId).toBe(1);
    expect(result.tabs[0]).toMatchObject({ preview: false });
  });

  it("reuses persistent tabs and replaces the preview slot", () => {
    expect(openEditorTabState([persistent], "/repo/README.md", false, () => 10).targetId).toBe(2);
    const result = openEditorTabState([preview], "/repo/new.ts", false, () => 10);
    expect(result.targetId).toBe(10);
    expect(result.tabs[0]).toMatchObject({ path: "/repo/new.ts", preview: true });
  });

  it("promotes only the requested editor tab", () => {
    expect(promoteEditorTab([preview, persistent], 1)[0]).toMatchObject({ preview: false });
    expect(promoteEditorTab([preview, persistent], 2)[0]).toMatchObject({ preview: true });
  });
});
