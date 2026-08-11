import { describe, expect, it } from "vitest";
import { swapLeafNodes, type PaneNode } from "./panes";

const leaf = (id: number, size?: number): PaneNode => ({
  kind: "leaf",
  id,
  cwd: `/tmp/${id}`,
  lastCommand: `agent-${id}`,
  size,
});

describe("swapLeafNodes", () => {
  it("swaps complete leaf positions in a flat split", () => {
    const tree: PaneNode = {
      kind: "split",
      id: 10,
      dir: "row",
      children: [leaf(1, 25), leaf(2, 75)],
    };

    expect(swapLeafNodes(tree, 1, 2)).toEqual({
      ...tree,
      children: [leaf(2, 75), leaf(1, 25)],
    });
  });

  it("swaps leaves across nested split branches without flattening them", () => {
    const tree: PaneNode = {
      kind: "split",
      id: 10,
      dir: "row",
      children: [
        leaf(1),
        {
          kind: "split",
          id: 20,
          dir: "col",
          children: [leaf(2), leaf(3)],
        },
      ],
    };

    const swapped = swapLeafNodes(tree, 1, 3);
    expect(swapped.kind).toBe("split");
    if (swapped.kind !== "split") return;
    expect(swapped.children[0]).toEqual(leaf(3));
    expect(swapped.children[1]).toMatchObject({
      kind: "split",
      id: 20,
      children: [leaf(2), leaf(1)],
    });
  });

  it("returns the original tree for a missing or identical ID", () => {
    const tree: PaneNode = {
      kind: "split",
      id: 10,
      dir: "row",
      children: [leaf(1), leaf(2)],
    };

    expect(swapLeafNodes(tree, 1, 99)).toBe(tree);
    expect(swapLeafNodes(tree, 1, 1)).toBe(tree);
  });
});
