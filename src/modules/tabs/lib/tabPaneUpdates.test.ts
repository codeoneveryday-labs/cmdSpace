import { describe, expect, it } from "vitest";
import type { Tab } from "./tabTypes";
import {
  focusTerminalPane,
  focusNextTerminalPane,
  replaceTerminalPaneTree,
  toggleTerminalPaneMaximize,
  updateLeafCwd,
  updateLeafLastCommand,
  updateLeafLaunchCommand,
} from "./tabPaneUpdates";

const tabs = [{
  id: 1,
  kind: "terminal",
  title: "shell",
  cwd: "/repo",
  paneTree: { kind: "leaf", id: 2, cwd: "/repo" },
  activeLeafId: 2,
}] as Tab[];

describe("tabPaneUpdates", () => {
  it("updates leaf metadata without touching unrelated tabs", () => {
    expect(updateLeafCwd(tabs, 2, "/repo/src")[0]).toMatchObject({ cwd: "/repo/src" });
    const withLastCommand = updateLeafLastCommand(tabs, 2, "ls")[0];
    const withLaunchCommand = updateLeafLaunchCommand(tabs, 2, "npm test")[0];
    expect(withLastCommand.kind).toBe("terminal");
    expect(withLaunchCommand.kind).toBe("terminal");
    if (withLastCommand.kind === "terminal") {
      expect(withLastCommand.paneTree).toMatchObject({ lastCommand: "ls" });
    }
    if (withLaunchCommand.kind === "terminal") {
      expect(withLaunchCommand.paneTree).toMatchObject({ lastCommand: "npm test", autoLaunch: true });
    }
  });

  it("focuses a valid pane and leaves invalid targets unchanged", () => {
    expect(focusTerminalPane(tabs, 1, 2)).toEqual(tabs);
    expect(focusTerminalPane(tabs, 1, 99)).toEqual(tabs);
  });

  it("advances to the next pane in a split tree", () => {
    const splitTabs = [{
      ...tabs[0],
      paneTree: {
        kind: "split" as const,
        id: 10,
        dir: "row" as const,
        children: [
          { kind: "leaf" as const, id: 2, cwd: "/repo/a" },
          { kind: "leaf" as const, id: 3, cwd: "/repo/b" },
        ],
      },
    }];
    const next = focusNextTerminalPane(splitTabs, 1, 1)[0];
    expect(next.kind).toBe("terminal");
    if (next.kind === "terminal") expect(next.activeLeafId).toBe(3);
  });

  it("replaces a tree while preserving valid active/maximized leaves", () => {
    const replacement = { kind: "leaf" as const, id: 9, cwd: "/repo/new" };
    const next = replaceTerminalPaneTree(tabs, 1, replacement)[0];
    expect(next.kind).toBe("terminal");
    if (next.kind === "terminal") {
      expect(next.activeLeafId).toBe(9);
      expect(next.paneTree).toBe(replacement);
    }
  });

  it("toggles maximize only on a pane that belongs to a terminal tab", () => {
    const maximized = toggleTerminalPaneMaximize(tabs, 2)[0];
    expect(maximized.kind).toBe("terminal");
    if (maximized.kind === "terminal") expect(maximized.maximizedLeafId).toBe(2);
  });
});
