import {
  createSurfaceNode,
} from "./architectureNodeFactory";
export { createCanvasNode, createSurfaceNode, edge, node } from "./architectureNodeFactory";
import {
  dockTerminal,
  normalizeTerminalDockGroups,
  type TerminalDockStackLayout,
} from "../terminalDockLayout";
import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  LiveSurfaceKind,
} from "./architectureCanvasTypes";
export {
  LEGACY_TERMINAL_SIZE,
  needsTerminalSizeMigration,
  normalizeDiagramSeed,
} from "./architectureDiagramNormalization";

export function createDockedSurfaceState({
  id,
  source,
  target,
  dockKind,
  liveSurfaceNodes,
  terminalDockGroups,
  initialCommand,
  created: providedCreated,
}: {
  id: string;
  source: ArchitectureNode;
  target: Pick<TerminalDockStackLayout, "groupId" | "stackId" | "rect">;
  dockKind: "tab" | "split";
  liveSurfaceNodes: ArchitectureNode[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  initialCommand?: string;
  created?: ArchitectureNode;
}): {
  created: ArchitectureNode;
  terminalDockGroups: ArchitectureTerminalDockGroup[];
} {
  const surfaceKind: LiveSurfaceKind =
    source.kind === "terminal" || source.kind === "browser"
      ? source.kind
      : "terminal";
  const created = providedCreated ??
    createSurfaceNode({
      id,
      kind: surfaceKind,
      x: target.rect.x,
      y: target.rect.y,
      width: target.rect.width,
      height: target.rect.height,
      cwd: source.cwd,
      initialCommand,
      frameId: source.frameId,
    });
  return {
    created,
    terminalDockGroups: dockTerminal(
      [
        ...normalizeTerminalDockGroups(liveSurfaceNodes, terminalDockGroups),
        ...normalizeTerminalDockGroups([created], undefined),
      ],
      created.id,
      dockKind === "tab"
        ? { kind: "tab", groupId: target.groupId, stackId: target.stackId }
        : {
            kind: "split",
            groupId: target.groupId,
            stackId: target.stackId,
            edge: "right",
          },
    ),
  };
}
