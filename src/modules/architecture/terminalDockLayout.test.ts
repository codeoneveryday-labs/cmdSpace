import { describe, expect, it } from "vitest";

import type {
  ArchitectureDiagramNode,
  ArchitectureTerminalDockGroup,
} from "@/modules/tabs";

import {
  activateTerminalTab,
  detachTerminal,
  dockTerminal,
  layoutTerminalDockDividers,
  layoutTerminalDockGroups,
  normalizeTerminalDockGroups,
  projectTerminalDockLayouts,
  removeTerminalFromDock,
  resolveTerminalDockDrop,
  terminalDockCornerClassName,
  terminalDockGroupUsesSharedHeader,
  terminalDockIndicatorRect,
  TERMINAL_DOCK_GROUP_HEADER_HEIGHT,
  updateTerminalDockSplitRatio,
  updateTerminalGroupBounds,
  type TerminalDockStackLayout,
} from "./terminalDockLayout";

function terminal(
  id: string,
  x: number,
  y: number,
): ArchitectureDiagramNode {
  return {
    id,
    kind: "terminal",
    label: id,
    technology: "zsh",
    x,
    y,
    width: 640,
    height: 400,
  };
}

function stack(
  terminalIds: string[],
  rect = { x: 0, y: 0, width: 500, height: 400 },
): TerminalDockStackLayout {
  return {
    groupId: "group-1",
    stackId: "stack-1",
    rect,
    terminalIds,
    activeTerminalId: terminalIds[0] ?? "",
  };
}

describe("normalizeTerminalDockGroups", () => {
  it("creates one single-tab group per terminal for a legacy diagram", () => {
    const groups = normalizeTerminalDockGroups(
      [terminal("terminal-1", 20, 40), terminal("terminal-2", 700, 40)],
      undefined,
    );

    expect(groups).toEqual([
      {
        id: "terminal-group-terminal-1",
        x: 20,
        y: 40,
        width: 640,
        height: 400,
        root: {
          id: "terminal-stack-terminal-1",
          kind: "tabs",
          terminalIds: ["terminal-1"],
          activeTerminalId: "terminal-1",
        },
      },
      {
        id: "terminal-group-terminal-2",
        x: 700,
        y: 40,
        width: 640,
        height: 400,
        root: {
          id: "terminal-stack-terminal-2",
          kind: "tabs",
          terminalIds: ["terminal-2"],
          activeTerminalId: "terminal-2",
        },
      },
    ]);
  });

  it("prunes missing and duplicate terminal membership and restores orphans", () => {
    const saved = [
      {
        id: "saved-group",
        x: 100,
        y: 120,
        width: 900,
        height: 600,
        root: {
          id: "saved-stack",
          kind: "tabs",
          terminalIds: ["terminal-1", "missing", "terminal-1"],
          activeTerminalId: "missing",
        },
      },
    ];

    const groups = normalizeTerminalDockGroups(
      [terminal("terminal-1", 20, 40), terminal("terminal-2", 700, 40)],
      saved,
    );

    expect(groups[0]).toMatchObject({
      id: "saved-group",
      root: {
        kind: "tabs",
        terminalIds: ["terminal-1"],
        activeTerminalId: "terminal-1",
      },
    });
    expect(groups[1]).toMatchObject({
      root: {
        terminalIds: ["terminal-2"],
        activeTerminalId: "terminal-2",
      },
    });
    expect(
      groups.flatMap((group) =>
        layoutTerminalDockGroups([group]).flatMap((item) => item.terminalIds),
      ),
    ).toEqual(["terminal-1", "terminal-2"]);
  });

  it("keeps a merged group when stale state also retains its source terminal", () => {
    const terminals = [
      terminal("source", 0, 0),
      terminal("target", 700, 0),
    ];
    const floatingGroups = normalizeTerminalDockGroups(terminals, undefined);
    const mergedGroup = dockTerminal(floatingGroups, "source", {
      kind: "tab",
      groupId: "terminal-group-target",
      stackId: "terminal-stack-target",
    })[0];

    const repaired = normalizeTerminalDockGroups(terminals, [
      floatingGroups[0],
      mergedGroup,
    ]);

    expect(repaired).toHaveLength(1);
    expect(layoutTerminalDockGroups(repaired)[0]).toMatchObject({
      terminalIds: ["target", "source"],
      activeTerminalId: "source",
    });
  });

  it("collapses a split whose other branch has no valid terminals", () => {
    const saved = [
      {
        id: "saved-group",
        x: 0,
        y: 0,
        width: 1000,
        height: 500,
        root: {
          id: "split-1",
          kind: "split",
          direction: "horizontal",
          ratio: 0.5,
          first: {
            id: "stack-valid",
            kind: "tabs",
            terminalIds: ["terminal-1"],
            activeTerminalId: "terminal-1",
          },
          second: {
            id: "stack-missing",
            kind: "tabs",
            terminalIds: ["missing"],
            activeTerminalId: "missing",
          },
        },
      },
    ];

    const groups = normalizeTerminalDockGroups(
      [terminal("terminal-1", 0, 0)],
      saved,
    );

    expect(groups[0].root).toEqual({
      id: "stack-valid",
      kind: "tabs",
      terminalIds: ["terminal-1"],
      activeTerminalId: "terminal-1",
    });
  });
});

describe("layoutTerminalDockGroups", () => {
  it("lets a single terminal use its own title bar", () => {
    const group: ArchitectureTerminalDockGroup = {
      id: "group-1",
      x: 100,
      y: 200,
      width: 1000,
      height: 600,
      root: {
        id: "stack-1",
        kind: "tabs",
        terminalIds: ["terminal-1"],
        activeTerminalId: "terminal-1",
      },
    };

    expect(TERMINAL_DOCK_GROUP_HEADER_HEIGHT).toBe(28);
    expect(terminalDockGroupUsesSharedHeader(group)).toBe(false);
    expect(layoutTerminalDockGroups([group])[0].rect).toEqual({
      x: 100,
      y: 200,
      width: 1000,
      height: 600,
    });
  });

  it("reserves shared chrome only when a group contains multiple terminals", () => {
    const group: ArchitectureTerminalDockGroup = {
      id: "group-1",
      x: 100,
      y: 200,
      width: 1000,
      height: 600,
      root: {
        id: "stack-1",
        kind: "tabs",
        terminalIds: ["terminal-1", "terminal-2"],
        activeTerminalId: "terminal-1",
      },
    };

    expect(terminalDockGroupUsesSharedHeader(group)).toBe(true);
    expect(layoutTerminalDockGroups([group])[0].rect).toEqual({
      x: 100,
      y: 228,
      width: 1000,
      height: 572,
    });
  });

  it("resolves recursive horizontal and vertical split rectangles", () => {
    const group: ArchitectureTerminalDockGroup = {
      id: "group-1",
      x: 100,
      y: 200,
      width: 1000,
      height: 600,
      root: {
        id: "split-horizontal",
        kind: "split",
        direction: "horizontal",
        ratio: 0.5,
        first: {
          id: "stack-left",
          kind: "tabs",
          terminalIds: ["terminal-1"],
          activeTerminalId: "terminal-1",
        },
        second: {
          id: "split-vertical",
          kind: "split",
          direction: "vertical",
          ratio: 0.5,
          first: {
            id: "stack-top",
            kind: "tabs",
            terminalIds: ["terminal-2"],
            activeTerminalId: "terminal-2",
          },
          second: {
            id: "stack-bottom",
            kind: "tabs",
            terminalIds: ["terminal-3"],
            activeTerminalId: "terminal-3",
          },
        },
      },
    };

    expect(layoutTerminalDockGroups([group])).toEqual([
      {
        groupId: "group-1",
        stackId: "stack-left",
        rect: { x: 100, y: 228, width: 500, height: 572 },
        terminalIds: ["terminal-1"],
        activeTerminalId: "terminal-1",
      },
      {
        groupId: "group-1",
        stackId: "stack-top",
        rect: { x: 600, y: 228, width: 500, height: 286 },
        terminalIds: ["terminal-2"],
        activeTerminalId: "terminal-2",
      },
      {
        groupId: "group-1",
        stackId: "stack-bottom",
        rect: { x: 600, y: 514, width: 500, height: 286 },
        terminalIds: ["terminal-3"],
        activeTerminalId: "terminal-3",
      },
    ]);
  });
});

describe("docked terminal seams", () => {
  const group: ArchitectureTerminalDockGroup = {
    id: "group-1",
    x: 100,
    y: 200,
    width: 1000,
    height: 600,
    root: {
      id: "split-horizontal",
      kind: "split",
      direction: "horizontal",
      ratio: 0.5,
      first: {
        id: "stack-left",
        kind: "tabs",
        terminalIds: ["terminal-1"],
        activeTerminalId: "terminal-1",
      },
      second: {
        id: "stack-right",
        kind: "tabs",
        terminalIds: ["terminal-2"],
        activeTerminalId: "terminal-2",
      },
    },
  };

  it("squares only the shared corners of adjacent terminals", () => {
    const [left, right] = layoutTerminalDockGroups([group]);
    const groupBounds = {
      x: group.x,
      y: group.y,
      width: group.width,
      height: group.height,
    };

    expect(terminalDockCornerClassName(left.rect, groupBounds)).toBe(
      "rounded-tl-none rounded-tr-none rounded-br-none rounded-bl-[12px]",
    );
    expect(terminalDockCornerClassName(right.rect, groupBounds)).toBe(
      "rounded-tl-none rounded-tr-none rounded-br-[12px] rounded-bl-none",
    );
  });

  it("exposes one full-height divider at the shared edge", () => {
    expect(layoutTerminalDockDividers([group])).toEqual([
      {
        groupId: "group-1",
        splitId: "split-horizontal",
        direction: "horizontal",
        rect: { x: 100, y: 228, width: 1000, height: 572 },
        ratio: 0.5,
      },
    ]);
  });

  it("updates just the dragged split ratio and preserves its children", () => {
    if (group.root.kind !== "split") throw new Error("expected split root");
    const next = updateTerminalDockSplitRatio(
      [group],
      "group-1",
      "split-horizontal",
      0.28,
    );

    expect(next[0].root).toMatchObject({
      id: "split-horizontal",
      ratio: 0.28,
      first: group.root.first,
      second: group.root.second,
    });
  });
});

describe("resolveTerminalDockDrop", () => {
  it("uses the first 38 screen pixels as the tab drop band", () => {
    expect(resolveTerminalDockDrop({ x: 250, y: 37 }, [stack(["source", "target"])], "source"))
      .toMatchObject({ kind: "tab", groupId: "group-1", stackId: "stack-1" });
  });

  it.each([
    ["top", { x: 250, y: 40 }],
    ["bottom", { x: 250, y: 380 }],
    ["left", { x: 20, y: 200 }],
    ["right", { x: 470, y: 200 }],
  ] as const)("resolves the %s split edge", (edge, point) => {
    expect(resolveTerminalDockDrop(point, [stack(["target"])], "source"))
      .toMatchObject({ kind: "split", edge });
  });

  it("does not dock over the target body center", () => {
    expect(
      resolveTerminalDockDrop(
        { x: 250, y: 200 },
        [stack(["target"])],
        "source",
      ),
    ).toBeNull();
  });

  it("does not dock a lone terminal onto its own stack", () => {
    expect(
      resolveTerminalDockDrop(
        { x: 250, y: 20 },
        [stack(["source"])],
        "source",
      ),
    ).toBeNull();
  });
});

describe("terminal dock screen projection", () => {
  it("projects Canvas stack bounds into client coordinates", () => {
    const layouts = [
      stack(["target"], { x: 600, y: 450, width: 500, height: 250 }),
    ];

    expect(
      projectTerminalDockLayouts(
        layouts,
        { x: 100, y: 200, width: 1000, height: 500 },
        { x: 10, y: 20, width: 500, height: 250 },
      ),
    ).toEqual([
      {
        ...layouts[0],
        rect: { x: 260, y: 145, width: 250, height: 125 },
      },
    ]);
  });

  it("returns the exact target half for a split preview", () => {
    const layouts = [stack(["target"])];
    const target = {
      kind: "split" as const,
      edge: "right" as const,
      groupId: "group-1",
      stackId: "stack-1",
    };

    expect(terminalDockIndicatorRect(target, layouts)).toEqual({
      x: 250,
      y: 0,
      width: 250,
      height: 400,
    });
  });

  it("returns only the header band for a tab preview", () => {
    const layouts = [stack(["target"])];

    expect(
      terminalDockIndicatorRect(
        { kind: "tab", groupId: "group-1", stackId: "stack-1" },
        layouts,
      ),
    ).toEqual({ x: 0, y: 0, width: 500, height: 38 });
  });
});

describe("terminal dock mutations", () => {
  function twoFloatingGroups(): ArchitectureTerminalDockGroup[] {
    return normalizeTerminalDockGroups(
      [terminal("source", 0, 0), terminal("target", 700, 0)],
      undefined,
    );
  }

  it("moves a source terminal into the target tab stack and activates it", () => {
    const groups = twoFloatingGroups();
    const target = layoutTerminalDockGroups(groups).find(
      (item) => item.terminalIds[0] === "target",
    )!;

    const next = dockTerminal(groups, "source", {
      kind: "tab",
      groupId: target.groupId,
      stackId: target.stackId,
    });

    expect(next).toHaveLength(1);
    expect(layoutTerminalDockGroups(next)).toEqual([
      {
        ...target,
        rect: { x: target.rect.x, y: target.rect.y + 28, width: target.rect.width, height: target.rect.height - 28 },
        terminalIds: ["target", "source"],
        activeTerminalId: "source",
      },
    ]);
  });

  it.each([
    ["left", "horizontal", ["source", "target"]],
    ["right", "horizontal", ["target", "source"]],
    ["top", "vertical", ["source", "target"]],
    ["bottom", "vertical", ["target", "source"]],
  ] as const)(
    "creates the correct %s split order",
    (edge, direction, terminalOrder) => {
      const groups = twoFloatingGroups();
      const target = layoutTerminalDockGroups(groups).find(
        (item) => item.terminalIds[0] === "target",
      )!;

      const next = dockTerminal(groups, "source", {
        kind: "split",
        edge,
        groupId: target.groupId,
        stackId: target.stackId,
      });

      expect(next).toHaveLength(1);
      expect(next[0].root).toMatchObject({ kind: "split", direction, ratio: 0.5 });
      expect(
        layoutTerminalDockGroups(next).map((item) => item.terminalIds[0]),
      ).toEqual(terminalOrder);
    },
  );

  it("collapses the old split after moving its only terminal to another group", () => {
    const grouped = dockTerminal(twoFloatingGroups(), "source", {
      kind: "split",
      edge: "right",
      groupId: "terminal-group-target",
      stackId: "terminal-stack-target",
    });
    const withThird = normalizeTerminalDockGroups(
      [
        terminal("source", 0, 0),
        terminal("target", 700, 0),
        terminal("third", 1400, 0),
      ],
      grouped,
    );
    const thirdStack = layoutTerminalDockGroups(withThird).find(
      (item) => item.terminalIds[0] === "third",
    )!;

    const next = dockTerminal(withThird, "source", {
      kind: "tab",
      groupId: thirdStack.groupId,
      stackId: thirdStack.stackId,
    });

    expect(next).toHaveLength(2);
    expect(next[0].root).toMatchObject({
      kind: "tabs",
      terminalIds: ["target"],
    });
    expect(layoutTerminalDockGroups(next)[1].terminalIds).toEqual([
      "third",
      "source",
    ]);
  });

  it("detaches one tab into a new floating group", () => {
    const tabbed = dockTerminal(twoFloatingGroups(), "source", {
      kind: "tab",
      groupId: "terminal-group-target",
      stackId: "terminal-stack-target",
    });

    const next = detachTerminal(tabbed, "source", {
      x: 100,
      y: 200,
      width: 500,
      height: 300,
    });

    expect(next).toHaveLength(2);
    expect(layoutTerminalDockGroups(next)).toEqual([
      expect.objectContaining({ terminalIds: ["target"] }),
      expect.objectContaining({
        rect: { x: 100, y: 200, width: 500, height: 300 },
        terminalIds: ["source"],
        activeTerminalId: "source",
      }),
    ]);
  });

  it("moves an already-floating single terminal without replacing its group", () => {
    const groups = twoFloatingGroups();
    const sourceGroup = groups[0];

    const next = detachTerminal(groups, "source", {
      x: 80,
      y: 90,
      width: 520,
      height: 320,
    });

    expect(next[0]).toMatchObject({
      id: sourceGroup.id,
      x: 80,
      y: 90,
      width: 520,
      height: 320,
    });
  });

  it("removes a terminal and collapses the surviving split branch", () => {
    const split = dockTerminal(twoFloatingGroups(), "source", {
      kind: "split",
      edge: "left",
      groupId: "terminal-group-target",
      stackId: "terminal-stack-target",
    });

    const next = removeTerminalFromDock(split, "source");

    expect(next).toHaveLength(1);
    expect(next[0].root).toMatchObject({
      kind: "tabs",
      terminalIds: ["target"],
      activeTerminalId: "target",
    });
  });

  it("activates a terminal only in the requested tab stack", () => {
    const tabbed = dockTerminal(twoFloatingGroups(), "source", {
      kind: "tab",
      groupId: "terminal-group-target",
      stackId: "terminal-stack-target",
    });

    const next = activateTerminalTab(
      tabbed,
      "terminal-stack-target",
      "target",
    );

    expect(layoutTerminalDockGroups(next)[0]).toMatchObject({
      terminalIds: ["target", "source"],
      activeTerminalId: "target",
    });
  });

  it("updates only the requested group's outer bounds", () => {
    const groups = twoFloatingGroups();

    const next = updateTerminalGroupBounds(
      groups,
      "terminal-group-source",
      { x: 10, y: 20, width: 900, height: 500 },
    );

    expect(next[0]).toMatchObject({ x: 10, y: 20, width: 900, height: 500 });
    expect(next[1]).toEqual(groups[1]);
  });
});
