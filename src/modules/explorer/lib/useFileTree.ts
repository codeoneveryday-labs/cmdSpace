import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { currentWorkspaceEnv } from "@/modules/workspace";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  createFileTreeMutations,
  type DeletedPath,
} from "./fileTreeMutations";
import { dirname, joinPath } from "./fileTreePaths";
import {
  emptyFileTreeState,
  loadedDirectoryPaths,
  type DirEntry,
  type PendingCreate,
  type TreeState,
} from "./fileTreeState";
import { filterExcludedFolders } from "./excludedFolders";
import { createDirectoryRequestTracker } from "./directoryRequestTracker";

export type { DirEntry, PendingCreate } from "./fileTreeState";

export type { DeletedPath } from "./fileTreeMutations";

export { dirname, joinPath } from "./fileTreePaths";

type Options = {
  onPathRenamed?: (from: string, to: string) => void;
  onPathDeleted?: (path: string) => void;
  onDeleteCommitted?: (records: DeletedPath[]) => void;
};

export function useFileTree(rootPath: string | null, options?: Options) {
  const showHidden = usePreferencesStore((s) => s.showHidden);
  const explorerExcludedFolderNames = usePreferencesStore(
    (s) => s.explorerExcludedFolderNames,
  );
  const showHiddenRef = useRef(showHidden);
  const excludedFolderNamesRef = useRef(explorerExcludedFolderNames);
  const requestTrackerRef = useRef(createDirectoryRequestTracker());
  const [nodes, setNodes] = useState<TreeState>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(
    null,
  );
  const [renaming, setRenaming] = useState<string | null>(null);

  useEffect(() => {
    showHiddenRef.current = showHidden;
    excludedFolderNamesRef.current = explorerExcludedFolderNames;
  }, [showHidden, explorerExcludedFolderNames]);

  const fetchChildren = useCallback(async (path: string) => {
    const request = requestTrackerRef.current.begin(path);
    setNodes((s) => ({ ...s, [path]: { status: "loading" } }));
    try {
      const entries = await invoke<DirEntry[]>("fs_read_dir", {
        path,
        showHidden: showHiddenRef.current,
        workspace: currentWorkspaceEnv(),
      });
      const visibleEntries = filterExcludedFolders(
        entries,
        excludedFolderNamesRef.current,
      );
      if (!requestTrackerRef.current.isCurrent(request)) return;
      setNodes((s) => ({
        ...s,
        [path]: { status: "loaded", entries: visibleEntries },
      }));
    } catch (e) {
      if (!requestTrackerRef.current.isCurrent(request)) return;
      setNodes((s) => ({
        ...s,
        [path]: { status: "error", message: String(e) },
      }));
    }
  }, []);

  // Root change → reset state.
  useEffect(() => {
    requestTrackerRef.current.reset();
    if (!rootPath) {
      const reset = emptyFileTreeState();
      setNodes(reset.nodes);
      setExpanded(reset.expanded);
      setPendingCreate(reset.pendingCreate);
      setRenaming(reset.renaming);
      return;
    }
    const reset = emptyFileTreeState();
    setNodes(reset.nodes);
    setExpanded(reset.expanded);
    setPendingCreate(reset.pendingCreate);
    setRenaming(reset.renaming);
    void fetchChildren(rootPath);
  }, [rootPath, fetchChildren]);

  useEffect(() => {
    if (!rootPath) return;
    const loadedPaths = loadedDirectoryPaths(nodes);
    for (const path of loadedPaths) void fetchChildren(path);
    // Re-list loaded directories when visibility preferences change.
    // `nodes` is intentionally omitted so ordinary tree edits don't refetch
    // every expanded directory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden, explorerExcludedFolderNames, rootPath, fetchChildren]);

  const mutations = useMemo(
    () =>
      createFileTreeMutations({
        invoke,
        refresh: fetchChildren,
        workspace: currentWorkspaceEnv,
        onPathRenamed: options?.onPathRenamed,
        onPathDeleted: options?.onPathDeleted,
        onDeleteCommitted: options?.onDeleteCommitted,
      }),
    [fetchChildren, options],
  );

  const toggle = useCallback(
    (path: string) => {
      setExpanded((curr) => {
        const next = new Set(curr);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
      setNodes((curr) => {
        if (!curr[path] || curr[path].status === "error") {
          void fetchChildren(path);
        }
        return curr;
      });
    },
    [fetchChildren],
  );

  const expand = useCallback(
    (path: string) => {
      setExpanded((curr) => {
        if (curr.has(path)) return curr;
        const next = new Set(curr);
        next.add(path);
        return next;
      });
      setNodes((curr) => {
        if (!curr[path]) void fetchChildren(path);
        return curr;
      });
    },
    [fetchChildren],
  );

  const refresh = useCallback(
    (path: string) => {
      void fetchChildren(path);
    },
    [fetchChildren],
  );

  // --- mutations ---

  const beginCreate = useCallback(
    (parentPath: string, kind: "file" | "dir") => {
      setRenaming(null);
      setPendingCreate({ parentPath, kind });
      // Ensure the parent is expanded so the input row is visible.
      if (rootPath && parentPath !== rootPath) {
        setExpanded((curr) => {
          if (curr.has(parentPath)) return curr;
          const next = new Set(curr);
          next.add(parentPath);
          return next;
        });
      }
      setNodes((curr) => {
        if (!curr[parentPath]) void fetchChildren(parentPath);
        return curr;
      });
    },
    [rootPath, fetchChildren],
  );

  const cancelCreate = useCallback(() => setPendingCreate(null), []);

  const commitCreate = useCallback(
    async (name: string) => {
      if (!pendingCreate) return;
      const trimmed = name.trim();
      if (!trimmed) {
        setPendingCreate(null);
        return;
      }
      try {
        await mutations.create(
          pendingCreate.parentPath,
          pendingCreate.kind,
          trimmed,
        );
      } finally {
        setPendingCreate(null);
      }
    },
    [mutations, pendingCreate],
  );

  const beginRename = useCallback((path: string) => {
    setPendingCreate(null);
    setRenaming(path);
  }, []);

  const cancelRename = useCallback(() => setRenaming(null), []);

  const commitRename = useCallback(
    async (newName: string) => {
      if (!renaming) return;
      const trimmed = newName.trim();
      const parent = dirname(renaming);
      const oldName = renaming.slice(parent === "/" ? 1 : parent.length + 1);
      if (!trimmed || trimmed === oldName) {
        setRenaming(null);
        return;
      }
      try {
        await mutations.rename(renaming, trimmed);
      } finally {
        setRenaming(null);
      }
    },
    [mutations, renaming],
  );

  const deletePath = useCallback(
    async (path: string) => mutations.deletePath(path),
    [mutations],
  );

  const deletePaths = useCallback(
    async (paths: string[]) => mutations.deletePaths(paths),
    [mutations],
  );

  const movePaths = useCallback(
    async (paths: string[], destination: string) => mutations.movePaths(paths, destination),
    [mutations],
  );

  const importPaths = useCallback(
    async (sources: string[], destination: string) =>
      mutations.importPaths(sources, destination),
    [mutations],
  );

  const importClipboardFile = useCallback(
    async (name: string, dataBase64: string, destination: string) =>
      mutations.importClipboardFile(name, dataBase64, destination),
    [mutations],
  );

  const restorePaths = useCallback(
    async (records: DeletedPath[]) => mutations.restorePaths(records),
    [mutations],
  );

  return {
    nodes,
    expanded,
    pendingCreate,
    renaming,
    toggle,
    expand,
    refresh,
    beginCreate,
    cancelCreate,
    commitCreate,
    beginRename,
    cancelRename,
    commitRename,
    deletePath,
    deletePaths,
    movePaths,
    importPaths,
    importClipboardFile,
    restorePaths,
    joinPath,
  };
}
