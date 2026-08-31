import { describe, expect, it } from "vitest";

import type { TerminalTab } from "@/modules/tabs";
import { getTerminalPaneRenderState } from "./terminalPaneRenderModel";

const tab: TerminalTab = {
  id: 7,
  kind: "terminal",
  title: "Terminal",
  cwd: "/workspace",
  paneTree: {
    kind: "split",
    id: 1,
    dir: "row",
    children: [
      { kind: "leaf", id: 2, cwd: "/workspace", lastCommand: "npm test" },
      { kind: "leaf", id: 3, cwd: "/workspace/src", autoLaunch: true },
    ],
  },
  activeLeafId: 2,
};

describe("getTerminalPaneRenderState", () => {
  it("keeps the complete pane tree when no leaf is maximized", () => {
    expect(getTerminalPaneRenderState(tab)).toEqual({
      node: tab.paneTree,
      leafIds: [2, 3],
    });
  });

  it("projects only the maximized leaf while preserving its persisted metadata", () => {
    expect(
      getTerminalPaneRenderState({ ...tab, maximizedLeafId: 2 }),
    ).toEqual({
      node: {
        kind: "leaf",
        id: 2,
        cwd: "/workspace",
        lastCommand: "npm test",
        autoLaunch: false,
      },
      leafIds: [2],
    });
  });

  it("returns an empty view when no terminal tab is active", () => {
    expect(getTerminalPaneRenderState(null)).toEqual({ node: null, leafIds: [] });
  });
});
