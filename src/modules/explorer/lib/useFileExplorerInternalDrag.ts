import { useCallback, useState, type RefObject } from "react";
import { canMovePathsTo, removeDescendants } from "./selection";

export type InternalDropTarget = {
  path: string;
  isDir: boolean;
};

export function useFileExplorerInternalDrag({
  scrollRef,
  rootPath,
  resolveDestination,
  movePaths,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  rootPath: string | null;
  resolveDestination: (targetPath?: string, targetIsDir?: boolean) => string;
  movePaths: (paths: string[], targetPath: string, targetIsDir: boolean) => void;
}) {
  const [dropTarget, setDropTarget] = useState<InternalDropTarget | null>(null);

  const resolveTarget = useCallback(
    (clientX: number, clientY: number): InternalDropTarget | null => {
      const scrollElement = scrollRef.current;
      const rect = scrollElement?.getBoundingClientRect();
      if (
        !scrollElement ||
        !rect ||
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }
      const row = document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLElement>("[data-fs-path]");
      if (row && scrollElement.contains(row)) {
        return {
          path: row.dataset.fsPath ?? rootPath ?? "",
          isDir: row.dataset.fsIsDir === "true",
        };
      }
      return { path: rootPath ?? "", isDir: true };
    },
    [rootPath, scrollRef],
  );

  const handleDragMove = useCallback(
    (paths: string[], clientX: number, clientY: number) => {
      const target = resolveTarget(clientX, clientY);
      if (!target) {
        setDropTarget(null);
        return;
      }
      const destination = resolveDestination(target.path, target.isDir);
      setDropTarget(
        canMovePathsTo(removeDescendants(paths), destination) ? target : null,
      );
    },
    [resolveDestination, resolveTarget],
  );

  const handleDragEnd = useCallback(
    (paths: string[], clientX: number, clientY: number) => {
      const target = resolveTarget(clientX, clientY);
      setDropTarget(null);
      if (target) movePaths(paths, target.path, target.isDir);
    },
    [movePaths, resolveTarget],
  );
  const clearDropTarget = useCallback(() => setDropTarget(null), []);

  return {
    dropTarget,
    handleDragMove,
    handleDragEnd,
    clearDropTarget,
  };
}
