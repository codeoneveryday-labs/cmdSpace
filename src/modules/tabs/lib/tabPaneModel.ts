import {
  leafIds,
  type PaneNode,
  type SplitDir,
} from "@/modules/terminal/lib/panes";

export const MAX_PANES_PER_TAB = 12;

export type SavedPaneInfo = {
  paneIndex: number;
  workingFolder: string | null;
  lastCommand: string | null;
  autoLaunch: boolean;
};

function terminalGridShape(count: number): { columns: number; rows: number } {
  if (count <= 1) return { columns: 1, rows: 1 };
  if (count <= 2) return { columns: 2, rows: 1 };
  if (count <= 4) return { columns: 2, rows: 2 };
  if (count <= 6) return { columns: 2, rows: 3 };
  if (count <= 8) return { columns: 2, rows: 4 };
  if (count <= 10) return { columns: 2, rows: 5 };
  return { columns: 3, rows: 4 };
}

function sanitizePaneSize(size: unknown): number | undefined {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return undefined;
  return Math.min(100, Math.max(0.001, Number(size.toFixed(3))));
}

function countSavedPaneLayoutLeaves(value: unknown): number {
  if (typeof value !== "object" || value === null) return 0;
  const node = value as { kind?: unknown; children?: unknown };
  if (node.kind === "leaf") return 1;
  if (node.kind !== "split" || !Array.isArray(node.children)) return 0;
  return node.children.reduce((sum, child) => sum + countSavedPaneLayoutLeaves(child), 0);
}

function parseSavedPaneLayout(layout: string | null | undefined): unknown {
  if (!layout) return null;
  try { return JSON.parse(layout); } catch { return null; }
}

export function createPaneTree(
  count: number,
  cwd: string | undefined,
  nextId: () => number,
  panes?: SavedPaneInfo[],
  paneLayout?: string | null,
): { paneTree: PaneNode; activeLeafId: number } {
  const paneCount = Math.min(MAX_PANES_PER_TAB, Math.max(1, Math.floor(count)));
  const savedLayout = parseSavedPaneLayout(paneLayout);
  if (countSavedPaneLayoutLeaves(savedLayout) === paneCount) {
    let currentPaneIdx = 0;
    const buildFromSavedLayout = (value: unknown): PaneNode | null => {
      if (typeof value !== "object" || value === null) return null;
      const savedNode = value as { kind?: unknown; dir?: unknown; children?: unknown; size?: unknown };
      const size = sanitizePaneSize(savedNode.size);
      if (savedNode.kind === "leaf") {
        const savedPane = panes?.find((pane) => pane.paneIndex === currentPaneIdx++);
        return { kind: "leaf", id: nextId(), cwd: savedPane?.workingFolder ?? cwd, lastCommand: savedPane?.lastCommand ?? undefined, autoLaunch: savedPane?.autoLaunch ?? false, ...(size !== undefined && { size }) };
      }
      if (savedNode.kind !== "split" || (savedNode.dir !== "row" && savedNode.dir !== "col") || !Array.isArray(savedNode.children)) return null;
      const children = savedNode.children.map(buildFromSavedLayout).filter((child): child is PaneNode => child !== null);
      if (children.length === 0) return null;
      if (children.length === 1) return size !== undefined ? { ...children[0], size } : children[0];
      return { kind: "split", id: nextId(), dir: savedNode.dir, children, ...(size !== undefined && { size }) };
    };
    const paneTree = buildFromSavedLayout(savedLayout);
    if (paneTree) return { paneTree, activeLeafId: leafIds(paneTree)[0] };
  }

  const buildStack = (children: PaneNode[], dir: SplitDir): PaneNode => children.length === 1 ? children[0] : { kind: "split", id: nextId(), dir, children };
  const { columns } = terminalGridShape(paneCount);
  const baseRows = Math.floor(paneCount / columns);
  const extraRows = paneCount % columns;
  const columnCounts = Array.from({ length: columns }, (_, column) => baseRows + (column < extraRows ? 1 : 0)).filter((columnCount) => columnCount > 0);
  let currentPaneIdx = 0;
  const buildColumn = (leafCount: number): PaneNode => buildStack(Array.from({ length: leafCount }, () => {
    const savedPane = panes?.find((pane) => pane.paneIndex === currentPaneIdx++);
    return { kind: "leaf", id: nextId(), cwd: savedPane?.workingFolder ?? cwd, lastCommand: savedPane?.lastCommand ?? undefined, autoLaunch: savedPane?.autoLaunch ?? false };
  }), "col");
  const paneTree = buildStack(columnCounts.map(buildColumn), "row");
  return { paneTree, activeLeafId: leafIds(paneTree)[0] };
}
