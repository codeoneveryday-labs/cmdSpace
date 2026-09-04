import { describe, expect, it } from "vitest";
import type { TerminalTab } from "./tabTypes";
import {
  closePaneFromTerminalTab,
  closeTerminalPaneState,
} from "./tabPaneClose";

const tab: TerminalTab = {
  id: 1,
  kind: "terminal",
  title: "shell",
  cwd: "/repo",
  paneTree: {
    kind: "split",
    id: 10,
    dir: "row",
    children: [
      { kind: "leaf", id: 2, cwd: "/repo/a" },
      { kind: "leaf", id: 3, cwd: "/repo/b" },
    ],
  },
  activeLeafId: 2,
  maximizedLeafId: 2,
};

describe("tabPaneClose", () => {
  it("selects the sibling and clears its maximize state", () => {
    const result = closePaneFromTerminalTab(tab, 2);
    expect(result.removed).toBe(true);
    expect(result.tab?.activeLeafId).toBe(3);
    expect(result.tab?.maximizedLeafId).toBeUndefined();
  });

  it("returns null when the last pane is closed", () => {
    const single = { ...tab, paneTree: { kind: "leaf" as const, id: 2 } };
    expect(closePaneFromTerminalTab(single, 2).tab).toBeNull();
  });

  it("removes a terminal tab and selects its previous sibling", () => {
    const tabs = [
      { id: 0, kind: "markdown" as const, title: "before", path: "/before.md" },
      { ...tab, paneTree: { kind: "leaf" as const, id: 2 } },
      { id: 3, kind: "markdown" as const, title: "after", path: "/after.md" },
    ];

    expect(closeTerminalPaneState(tabs, 1, 2)).toMatchObject({
      tabs: [tabs[0], tabs[2]],
      removed: true,
      closedTab: true,
      disposedLeafId: 2,
      replacementActiveId: 0,
    });
  });

  it("keeps the final tab but still marks its terminal for disposal", () => {
    const single = { ...tab, paneTree: { kind: "leaf" as const, id: 2 } };

    expect(closeTerminalPaneState([single], 1, 2)).toMatchObject({
      tabs: [single],
      removed: true,
      closedTab: false,
      disposedLeafId: 2,
      replacementActiveId: null,
    });
  });
});
