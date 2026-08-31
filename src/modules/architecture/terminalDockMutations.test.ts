import { describe, expect, it } from "vitest";
import type { ArchitectureTerminalDockGroup } from "@/modules/tabs";
import {
  activateTerminalTab,
  dockTerminal,
  removeTerminalFromDock,
  updateTerminalDockSplitRatio,
} from "./terminalDockMutations";
import { layoutTerminalDockGroups } from "./terminalDockGeometry";

const group = (id: string, terminalIds: string[]): ArchitectureTerminalDockGroup => ({
  id,
  x: 0,
  y: 0,
  width: 800,
  height: 500,
  root: {
    id: `${id}-stack`,
    kind: "tabs",
    terminalIds,
    activeTerminalId: terminalIds[0],
  },
});

describe("terminalDockMutations", () => {
  it("removes a terminal and preserves the other stack", () => {
    expect(removeTerminalFromDock([group("one", ["a", "b"])], "a")[0].root).toMatchObject({
      terminalIds: ["b"],
      activeTerminalId: "b",
    });
  });

  it("docks a terminal into a target tab stack and updates its active tab", () => {
    const next = dockTerminal(
      [group("source", ["a"]), group("target", ["b"])],
      "a",
      { kind: "tab", groupId: "target", stackId: "target-stack" },
    );
    expect(layoutTerminalDockGroups(next)).toMatchObject([
      { groupId: "target", terminalIds: ["b", "a"], activeTerminalId: "a" },
    ]);
  });

  it("clamps split ratio and keeps unrelated groups unchanged", () => {
    const split: ArchitectureTerminalDockGroup = {
      ...group("split", ["a"]),
      root: {
        id: "split-root",
        kind: "split",
        direction: "horizontal",
        ratio: 0.5,
        first: group("first", ["a"]).root,
        second: group("second", ["b"]).root,
      },
    };
    const next = updateTerminalDockSplitRatio(
      [split, group("other", ["c"])],
      "split",
      "split-root",
      2,
    );
    expect(next[0].root).toMatchObject({ ratio: 0.9 });
    expect(next[1]).toEqual(group("other", ["c"]));
    expect(activateTerminalTab(next, "split-root", "b")[0].root).toMatchObject({
      second: { activeTerminalId: "b" },
    });
  });
});
