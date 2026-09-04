import { describe, expect, it } from "vitest";
import type { Tab } from "./tabTypes";
import { closeTabState, resetWorkspaceState } from "./tabCloseModel";

const tabs = [
  { id: 1, kind: "markdown", title: "A", path: "/a.md" },
  { id: 2, kind: "markdown", title: "B", path: "/b.md" },
  { id: 3, kind: "markdown", title: "C", path: "/c.md" },
] as Tab[];

describe("tabCloseModel", () => {
  it("removes a tab and selects its previous sibling", () => {
    const result = closeTabState(tabs, 2, 2);
    expect(result.tabs.map((tab) => tab.id)).toEqual([1, 3]);
    expect(result.activeId).toBe(1);
  });

  it("does not remove the last tab or an unknown tab", () => {
    expect(closeTabState([tabs[0]], 1, 1).tabs).toEqual([tabs[0]]);
    expect(closeTabState(tabs, 2, 99).tabs).toEqual(tabs);
  });

  it("resets to one terminal and reports all terminal leaves for disposal", () => {
    const result = resetWorkspaceState(tabs, 9, 10, "/repo");
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0]).toMatchObject({ id: 9, kind: "terminal", activeLeafId: 10 });
    expect(result.disposedLeafIds).toEqual([]);
  });
});
