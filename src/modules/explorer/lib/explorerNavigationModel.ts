export type ExplorerNavigationRow = {
  path: string;
  isDir: boolean;
  isExpanded: boolean;
};

export type ExplorerNavigationAction =
  | { type: "clear" }
  | { type: "move"; index: number; extend: boolean }
  | { type: "toggle"; path: string }
  | { type: "open"; path: string }
  | { type: "delete" };

export function resolveExplorerNavigation(
  key: string,
  shiftKey: boolean,
  currentIndex: number,
  entryPaths: string[],
  entryByPath: ReadonlyMap<string, ExplorerNavigationRow>,
  rootPath: string,
  selectedCount: number,
): ExplorerNavigationAction | null {
  if (key === "Escape") return { type: "clear" };
  if (key === "Delete") return selectedCount > 0 ? { type: "delete" } : null;
  if (entryPaths.length === 0 || currentIndex < 0 && !["ArrowUp", "ArrowDown"].includes(key)) return null;

  if (key === "ArrowDown") {
    return { type: "move", index: Math.min(entryPaths.length - 1, currentIndex < 0 ? 0 : currentIndex + 1), extend: shiftKey };
  }
  if (key === "ArrowUp") {
    return { type: "move", index: Math.max(0, currentIndex < 0 ? entryPaths.length - 1 : currentIndex - 1), extend: shiftKey };
  }

  const path = entryPaths[currentIndex];
  const row = path ? entryByPath.get(path) : undefined;
  if (!row) return null;
  if (key === "Enter") return row.isDir ? { type: "toggle", path } : { type: "open", path };
  if (key === "ArrowRight") {
    return row.isDir
      ? row.isExpanded
        ? { type: "move", index: Math.min(entryPaths.length - 1, currentIndex + 1), extend: shiftKey }
        : { type: "toggle", path }
      : null;
  }
  if (key === "ArrowLeft") {
    if (row.isDir && row.isExpanded) return { type: "toggle", path };
    const parent = path.slice(0, path.lastIndexOf("/"));
    return parent && parent !== rootPath ? { type: "move", index: entryPaths.indexOf(parent), extend: false } : null;
  }
  return null;
}
