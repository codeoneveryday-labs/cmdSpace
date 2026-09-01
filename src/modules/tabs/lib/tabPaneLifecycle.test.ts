import { describe, expect, it } from "vitest";
import { appendTerminalPane, splitTerminalPane } from "./tabPaneLifecycle";
import type { TerminalTab } from "./tabTypes";

const tab: TerminalTab = {
  id: 1,
  kind: "terminal",
  title: "shell",
  cwd: "/repo",
  paneTree: { kind: "leaf", id: 2, cwd: "/repo" },
  activeLeafId: 2,
  maximizedLeafId: 2,
};

describe("tabPaneLifecycle", () => {
  it("splits the active pane and clears maximization", () => {
    let id = 10;
    const result = splitTerminalPane(tab, () => id++, "row");
    expect(result?.leafId).toBe(11);
    expect(result?.tab.activeLeafId).toBe(11);
    expect(result?.tab.maximizedLeafId).toBeUndefined();
  });

  it("appends a pane with cwd and launch metadata", () => {
    let id = 20;
    const result = appendTerminalPane(tab, () => id++, "/repo/src", "npm test");
    expect(result?.tab.cwd).toBe("/repo/src");
    expect(result?.paneTree).toMatchObject({ kind: "split" });
  });
});
