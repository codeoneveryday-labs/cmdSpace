import { describe, expect, it } from "vitest";
import { setLeafLaunchCommand, type PaneNode } from "./panes";

describe("setLeafLaunchCommand", () => {
  it("sets an agent command as the leaf launch plan", () => {
    expect(setLeafLaunchCommand({ kind: "leaf", id: 7 }, 7, "codex")).toEqual({
      kind: "leaf",
      id: 7,
      lastCommand: "codex",
      autoLaunch: true,
    });
  });

  it("clears the launch plan when switching to Terminal", () => {
    expect(
      setLeafLaunchCommand(
        { kind: "leaf", id: 7, lastCommand: "codex", autoLaunch: true },
        7,
        null,
      ),
    ).toEqual({ kind: "leaf", id: 7 });
  });

  it("updates only the requested nested leaf", () => {
    const tree: PaneNode = {
      kind: "split",
      id: 1,
      dir: "row",
      children: [
        { kind: "leaf", id: 2, lastCommand: "claude", autoLaunch: true },
        { kind: "leaf", id: 3, lastCommand: "codex", autoLaunch: true },
      ],
    };

    expect(setLeafLaunchCommand(tree, 3, "gemini")).toEqual({
      ...tree,
      children: [
        tree.children[0],
        { kind: "leaf", id: 3, lastCommand: "gemini", autoLaunch: true },
      ],
    });
  });
});
