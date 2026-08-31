export { normalizeTerminalDockGroups } from "./terminalDockNormalization";
export {
  layoutTerminalDockDividers,
  layoutTerminalDockGroups,
  projectMaximizedTerminalDockGroups,
  projectTerminalDockLayouts,
  resolveTerminalDockDrop,
  terminalDockCornerClassName,
  terminalDockGroupUsesSharedHeader,
  terminalDockIndicatorRect,
  TERMINAL_DOCK_GROUP_HEADER_HEIGHT,
} from "./terminalDockGeometry";
export {
  activateTerminalTab,
  detachTerminal,
  dockTerminal,
  removeTerminalFromDock,
  updateTerminalDockSplitRatio,
  updateTerminalGroupBounds,
} from "./terminalDockMutations";

export type TerminalDockRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TerminalDockStackLayout = {
  groupId: string;
  stackId: string;
  rect: TerminalDockRect;
  terminalIds: string[];
  activeTerminalId: string;
};

export type TerminalDockDividerLayout = {
  groupId: string;
  splitId: string;
  direction: "horizontal" | "vertical";
  rect: TerminalDockRect;
  ratio: number;
};

export type TerminalDockEdge = "top" | "bottom" | "left" | "right";

export type TerminalDockDropTarget =
  | {
      kind: "tab";
      groupId: string;
      stackId: string;
    }
  | {
      kind: "split";
      groupId: string;
      stackId: string;
      edge: TerminalDockEdge;
    };
