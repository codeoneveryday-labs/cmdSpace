import { getSelectionRange } from "./selection";

export type FileExplorerSelectionState = {
  selectedPaths: string[];
  selectionAnchor: string | null;
  focusedPath: string | null;
};

export function resetFileExplorerSelectionState(
  _state?: FileExplorerSelectionState,
): FileExplorerSelectionState {
  return {
    selectedPaths: [],
    selectionAnchor: null,
    focusedPath: null,
  };
}

export function pruneFileExplorerSelectionState(
  state: FileExplorerSelectionState,
  entryIndexByPath: ReadonlyMap<string, number>,
): FileExplorerSelectionState {
  const selectedPaths = state.selectedPaths.filter((path) =>
    entryIndexByPath.has(path),
  );
  const focusedPath =
    state.focusedPath && !entryIndexByPath.has(state.focusedPath)
      ? null
      : state.focusedPath;

  if (
    selectedPaths.length === state.selectedPaths.length &&
    focusedPath === state.focusedPath
  ) {
    return state;
  }

  return {
    ...state,
    selectedPaths,
    focusedPath,
  };
}

export function selectFileExplorerPath(
  state: FileExplorerSelectionState,
  entryPaths: string[],
  path: string,
  extend: boolean,
): FileExplorerSelectionState {
  if (extend && state.selectionAnchor && entryPaths.includes(state.selectionAnchor)) {
    return {
      selectedPaths: getSelectionRange(entryPaths, state.selectionAnchor, path),
      selectionAnchor: state.selectionAnchor,
      focusedPath: path,
    };
  }

  return {
    selectedPaths: [path],
    selectionAnchor: path,
    focusedPath: path,
  };
}
