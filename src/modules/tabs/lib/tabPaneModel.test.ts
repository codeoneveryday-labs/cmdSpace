import { describe, expect, it } from "vitest";
import { createPaneTree, MAX_PANES_PER_TAB } from "./tabPaneModel";
import { leafIds } from "@/modules/terminal/lib/panes";

describe("tabPaneModel", () => {
  it("clamps pane count and builds a stable grid", () => {
    let nextId = 1;
    const result = createPaneTree(99, "/repo", () => nextId++);
    expect(leafIds(result.paneTree)).toHaveLength(MAX_PANES_PER_TAB);
    expect(result.activeLeafId).toBe(1);
  });

  it("restores saved pane metadata and layout when leaf counts match", () => {
    let nextId = 10;
    const result = createPaneTree(
      2,
      "/repo",
      () => nextId++,
      [
        { paneIndex: 0, workingFolder: "/repo/a", lastCommand: "ls", autoLaunch: true },
        { paneIndex: 1, workingFolder: "/repo/b", lastCommand: null, autoLaunch: false },
      ],
      JSON.stringify({
        kind: "split",
        dir: "row",
        children: [{ kind: "leaf", size: 40 }, { kind: "leaf", size: 60 }],
      }),
    );
    expect(leafIds(result.paneTree)).toHaveLength(2);
    expect(result.paneTree.kind).toBe("split");
  });
});
