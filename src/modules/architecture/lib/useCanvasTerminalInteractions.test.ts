import { describe, expect, it } from "vitest";

import type {
  ArchitectureDiagramNode,
  ArchitectureTerminalDockGroup,
} from "@/modules/tabs";

import type {
  TerminalDockDropTarget,
  TerminalDockStackLayout,
} from "../terminalDockLayout";
import {
  resolveNextTerminalTabState,
  resolveTerminalDropResult,
} from "./useCanvasTerminalInteractions";

describe("useCanvasTerminalInteractions helpers", () => {
  it("moves active and maximized terminal state to the surviving tab when closing the current tab", () => {
    expect(
      resolveNextTerminalTabState({
        activeTerminalId: "terminal-2",
        closingTerminalId: "terminal-2",
        maximizedTerminalId: "terminal-2",
        terminalIds: ["terminal-1", "terminal-2"],
      }),
    ).toEqual({
      activeTerminalId: "terminal-1",
      maximizedTerminalId: "terminal-1",
    });
  });

  it("prefers docking over floating detach when a drag finishes on a dock target", () => {
    const terminalNodes = [
      terminalNode("source"),
      terminalNode("target"),
    ];
    const terminalDockGroups = [
      floatingGroup("source"),
      floatingGroup("target", 720, 0),
    ];
    const terminalLayouts: TerminalDockStackLayout[] = [
      {
        groupId: "terminal-group-source",
        stackId: "terminal-stack-source",
        rect: { x: 0, y: 0, width: 640, height: 400 },
        terminalIds: ["source"],
        activeTerminalId: "source",
      },
      {
        groupId: "terminal-group-target",
        stackId: "terminal-stack-target",
        rect: { x: 720, y: 0, width: 640, height: 400 },
        terminalIds: ["target"],
        activeTerminalId: "target",
      },
    ];
    const dockTarget: TerminalDockDropTarget = {
      kind: "tab",
      groupId: "terminal-group-target",
      stackId: "terminal-stack-target",
    };

    expect(
      resolveTerminalDropResult({
        drag: { id: "source", dx: 0, dy: 0 },
        dockTarget,
        draggedTerminal: terminalNode("source"),
        frameId: undefined,
        terminalDockGroups,
        terminalDropPreview: {
          id: "source",
          x: 720,
          y: 0,
          width: 640,
          height: 400,
        },
        terminalLayouts,
        terminalNodes,
      }),
    ).toEqual({
      kind: "dock",
      nextGroups: [
        {
          id: "terminal-group-target",
          x: 720,
          y: 0,
          width: 640,
          height: 400,
          root: {
            id: "terminal-stack-target",
            kind: "tabs",
            terminalIds: ["target", "source"],
            activeTerminalId: "source",
          },
        },
      ],
    });
  });

  it("detaches a floating terminal when the drag ends away from any dock target", () => {
    expect(
      resolveTerminalDropResult({
        drag: { id: "source", dx: 0, dy: 0 },
        dockTarget: null,
        draggedTerminal: terminalNode("source"),
        frameId: undefined,
        terminalDockGroups: [floatingGroup("source", 20, 40)],
        terminalDropPreview: {
          id: "source",
          x: 360,
          y: 240,
          width: 640,
          height: 400,
        },
        terminalLayouts: [
          {
            groupId: "terminal-group-source",
            stackId: "terminal-stack-source",
            rect: { x: 20, y: 40, width: 640, height: 400 },
            terminalIds: ["source"],
            activeTerminalId: "source",
          },
        ],
        terminalNodes: [terminalNode("source")],
      }),
    ).toEqual({
      kind: "detach",
      nextGroups: [
        {
          id: "source",
          x: 360,
          y: 240,
          width: 640,
          height: 400,
          root: {
            id: "terminal-stack-source",
            kind: "tabs",
            terminalIds: ["source"],
            activeTerminalId: "source",
          },
        },
      ],
    });
  });
});

function terminalNode(id: string): ArchitectureDiagramNode {
  return {
    id,
    kind: "terminal",
    label: id,
    technology: "zsh",
    x: 0,
    y: 0,
    width: 640,
    height: 400,
  };
}

function floatingGroup(
  terminalId: string,
  x = 0,
  y = 0,
): ArchitectureTerminalDockGroup {
  return {
    id: `terminal-group-${terminalId}`,
    x,
    y,
    width: 640,
    height: 400,
    root: {
      id: `terminal-stack-${terminalId}`,
      kind: "tabs",
      terminalIds: [terminalId],
      activeTerminalId: terminalId,
    },
  };
}
