import { useCallback } from "react";
import { resolveExplorerNavigation } from "./explorerNavigationModel";
import type { Row } from "./fileExplorerRows";

export function useFileExplorerKeyboard({
  tree,
  isSearchOpen,
  focusedPath,
  entryPaths,
  rows,
  rootPath,
  selectedCount,
  onUndoDelete,
  onClearSelection,
  onDeleteSelected,
  onOpenFile,
  onSelectPath,
  onScrollEntryIntoView,
}: {
  tree: {
    renaming: unknown;
    pendingCreate: unknown;
    toggle: (path: string) => void;
  };
  isSearchOpen: boolean;
  focusedPath: string | null;
  entryPaths: string[];
  rows: Row[];
  rootPath: string;
  selectedCount: number;
  onUndoDelete: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onOpenFile: (path: string) => void;
  onSelectPath: (path: string, extend: boolean) => void;
  onScrollEntryIntoView: (path: string) => void;
}) {
  return useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (tree.renaming || tree.pendingCreate || isSearchOpen) return;
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        onUndoDelete();
        return;
      }

      const currentIndex = focusedPath ? entryPaths.indexOf(focusedPath) : -1;
      const navigationRows = new Map(
        rows
          .filter((row): row is Extract<Row, { kind: "entry" }> => row.kind === "entry")
          .map((row) => [row.path, row]),
      );
      const action = resolveExplorerNavigation(
        event.key,
        event.shiftKey,
        currentIndex,
        entryPaths,
        navigationRows,
        rootPath,
        selectedCount,
      );
      if (!action) return;
      event.preventDefault();
      if (action.type === "clear") onClearSelection();
      else if (action.type === "delete") onDeleteSelected();
      else if (action.type === "toggle") tree.toggle(action.path);
      else if (action.type === "open") onOpenFile(action.path);
      else {
        const path = entryPaths[action.index];
        if (!path) return;
        onSelectPath(path, action.extend);
        requestAnimationFrame(() => onScrollEntryIntoView(path));
      }
    },
    [
      entryPaths,
      focusedPath,
      isSearchOpen,
      onClearSelection,
      onDeleteSelected,
      onOpenFile,
      onScrollEntryIntoView,
      onSelectPath,
      onUndoDelete,
      rootPath,
      rows,
      selectedCount,
      tree,
    ],
  );
}
