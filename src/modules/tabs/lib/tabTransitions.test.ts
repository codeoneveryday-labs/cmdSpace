import { describe, expect, it } from "vitest";
import type { Tab } from "./useTabs";
import { reorderTabs, tabAtIndex } from "./tabTransitions";

const tabs = [
  { id: 1, kind: "preview", title: "A", url: "https://a.test" },
  { id: 2, kind: "preview", title: "B", url: "https://b.test" },
  { id: 3, kind: "preview", title: "C", url: "https://c.test" },
] as Tab[];

describe("tabTransitions", () => {
  it("moves tabs before and after a target with index adjustment", () => {
    expect(reorderTabs(tabs, 1, 3).map((tab) => tab.id)).toEqual([2, 1, 3]);
    expect(reorderTabs(tabs, 3, 1, "after").map((tab) => tab.id)).toEqual([1, 3, 2]);
  });

  it("returns a copy for no-op and safely selects by index", () => {
    const result = reorderTabs(tabs, 2, 2);
    expect(result).toEqual(tabs);
    expect(result).not.toBe(tabs);
    expect(tabAtIndex(tabs, 1)?.id).toBe(2);
    expect(tabAtIndex(tabs, 99)).toBeNull();
  });
});
