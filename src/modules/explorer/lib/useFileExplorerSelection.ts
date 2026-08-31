import { useCallback, useEffect, useMemo, useState } from "react";
import {
  pruneFileExplorerSelectionState,
  resetFileExplorerSelectionState,
  selectFileExplorerPath,
  type FileExplorerSelectionState,
} from "./fileExplorerSelectionState";

export {
  resetFileExplorerSelectionState,
  selectFileExplorerPath,
} from "./fileExplorerSelectionState";

export function useFileExplorerSelection({
  rootPath,
  entryPaths,
  entryIndexByPath,
}: {
  rootPath: string | null;
  entryPaths: string[];
  entryIndexByPath: ReadonlyMap<string, number>;
}) {
  const [state, setState] = useState<FileExplorerSelectionState>(
    resetFileExplorerSelectionState,
  );

  useEffect(() => {
    setState((current) =>
      pruneFileExplorerSelectionState(current, entryIndexByPath),
    );
  }, [entryIndexByPath]);

  useEffect(() => {
    setState(resetFileExplorerSelectionState());
  }, [rootPath]);

  const { selectedPaths, focusedPath } = state;
  const selectedPathSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);

  const selectPath = useCallback(
    (path: string, extend: boolean) => {
      setState((current) =>
        selectFileExplorerPath(current, entryPaths, path, extend),
      );
    },
    [entryPaths],
  );

  const clearSelection = useCallback(() => {
    setState(resetFileExplorerSelectionState());
  }, []);

  return {
    selectedPaths,
    selectedPathSet,
    focusedPath,
    selectPath,
    clearSelection,
  };
}
