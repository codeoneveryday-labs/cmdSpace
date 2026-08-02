import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { currentWorkspaceEnv } from "@/modules/workspace";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { canMovePathsTo, removeDescendants } from "./selection";

export type DirEntry = {
  name: string;
  kind: "file" | "dir" | "symlink";
  size: number;
  mtime: number;
};

type ChildrenState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; entries: DirEntry[] }
  | { status: "error"; message: string };

type TreeState = Record<string, ChildrenState>;

export type PendingCreate = {
  parentPath: string;
  kind: "file" | "dir";
};

export type DeletedPath = {
  path: string;
  token: string;
};

export function joinPath(parent: string, name: string): string {
  if (parent.endsWith("/")) return `${parent}${name}`;
  return `${parent}/${name}`;
}

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  if (i <= 0) return "/";
  return path.slice(0, i);
}

type Options = {
  onPathRenamed?: (from: string, to: string) => void;
  onPathDeleted?: (path: string) => void;
  onDeleteCommitted?: (records: DeletedPath[]) => void;
};

export function useFileTree(rootPath: string | null, options?: Options) {
  const showHidden = usePreferencesStore((s) => s.showHidden);
  const showHiddenRef = useRef(showHidden);
  const [nodes, setNodes] = useState<TreeState>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(
    null,
  );
  const [renaming, setRenaming] = useState<string | null>(null);

  useEffect(() => {
    showHiddenRef.current = showHidden;
  }, [showHidden]);

  const fetchChildren = useCallback(async (path: string) => {
    setNodes((s) => ({ ...s, [path]: { status: "loading" } }));
    try {
      const entries = await invoke<DirEntry[]>("fs_read_dir", {
        path,
        showHidden: showHiddenRef.current,
        workspace: currentWorkspaceEnv(),
      });
      setNodes((s) => ({ ...s, [path]: { status: "loaded", entries } }));
    } catch (e) {
      setNodes((s) => ({
        ...s,
        [path]: { status: "error", message: String(e) },
      }));
    }
  }, []);

  // Root change → reset state.
  useEffect(() => {
    if (!rootPath) {
      setNodes({});
      setExpanded(new Set());
      setPendingCreate(null);
      setRenaming(null);
      return;
    }
    setPendingCreate(null);
    setRenaming(null);
    setExpanded(new Set());
    setNodes({});
    void fetchChildren(rootPath);
  }, [rootPath, fetchChildren]);

  useEffect(() => {
    if (!rootPath) return;
    const loadedPaths = Object.entries(nodes)
      .filter(([, state]) => state.status === "loaded")
      .map(([path]) => path);
    for (const path of loadedPaths) void fetchChildren(path);
    // Re-list loaded directories when the visibility preference changes.
    // `nodes` is intentionally omitted so ordinary tree edits don't refetch
    // every expanded directory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden, rootPath, fetchChildren]);

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
      const path = joinPath(pendingCreate.parentPath, trimmed);
      const cmd =
        pendingCreate.kind === "dir" ? "fs_create_dir" : "fs_create_file";
      try {
        await invoke(cmd, { path, workspace: currentWorkspaceEnv() });
        await fetchChildren(pendingCreate.parentPath);
      } catch (e) {
        console.error(`${cmd} failed:`, e);
      } finally {
        setPendingCreate(null);
      }
    },
    [pendingCreate, fetchChildren],
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
      const to = joinPath(parent, trimmed);
      try {
        await invoke("fs_rename", {
          from: renaming,
          to,
          workspace: currentWorkspaceEnv(),
        });
        options?.onPathRenamed?.(renaming, to);
        await fetchChildren(parent);
      } catch (e) {
        console.error("fs_rename failed:", e);
      } finally {
        setRenaming(null);
      }
    },
    [renaming, fetchChildren, options],
  );

  const deletePath = useCallback(
    async (path: string) => {
      try {
        const record = await invoke<DeletedPath>("fs_delete", {
          path,
          workspace: currentWorkspaceEnv(),
        });
        options?.onPathDeleted?.(path);
        options?.onDeleteCommitted?.([record]);
        await fetchChildren(dirname(path));
      } catch (e) {
        console.error("fs_delete failed:", e);
      }
    },
    [fetchChildren, options],
  );

  const deletePaths = useCallback(
    async (paths: string[]) => {
      const targets = removeDescendants(paths);
      const parents = new Set<string>();
      const records: DeletedPath[] = [];
      for (const path of targets) {
        try {
          const record = await invoke<DeletedPath>("fs_delete", {
            path,
            workspace: currentWorkspaceEnv(),
          });
          options?.onPathDeleted?.(path);
          records.push(record);
          parents.add(dirname(path));
        } catch (e) {
          console.error("fs_delete failed:", e);
        }
      }
      if (records.length > 0) options?.onDeleteCommitted?.(records);
      await Promise.all([...parents].map((parent) => fetchChildren(parent)));
    },
    [fetchChildren, options],
  );

  const movePaths = useCallback(
    async (paths: string[], destination: string) => {
      const sources = removeDescendants(paths);
      if (!canMovePathsTo(sources, destination)) {
        throw new Error("A folder cannot be moved into itself.");
      }
      const refreshPaths = new Set<string>([destination]);
      for (const from of sources) {
        const to = joinPath(destination, from.slice(from.lastIndexOf("/") + 1));
        await invoke("fs_rename", {
          from,
          to,
          workspace: currentWorkspaceEnv(),
        });
        options?.onPathRenamed?.(from, to);
        refreshPaths.add(dirname(from));
      }
      await Promise.all([...refreshPaths].map((path) => fetchChildren(path)));
    },
    [fetchChildren, options],
  );

  const importPaths = useCallback(
    async (sources: string[], destination: string) => {
      const imported = await invoke<string[]>("fs_import_paths", {
        sources,
        destination,
        workspace: currentWorkspaceEnv(),
      });
      await fetchChildren(destination);
      return imported;
    },
    [fetchChildren],
  );

  const importClipboardFile = useCallback(
    async (name: string, dataBase64: string, destination: string) => {
      const imported = await invoke<string>("fs_import_clipboard_file", {
        name,
        dataBase64,
        destination,
        workspace: currentWorkspaceEnv(),
      });
      await fetchChildren(destination);
      return imported;
    },
    [fetchChildren],
  );

  const restorePaths = useCallback(
    async (records: DeletedPath[]) => {
      const parents = new Set<string>();
      const ordered = [...records].sort((a, b) => a.path.length - b.path.length);
      for (const record of ordered) {
        try {
          await invoke("fs_restore", {
            path: record.path,
            token: record.token,
            workspace: currentWorkspaceEnv(),
          });
          parents.add(dirname(record.path));
        } catch (e) {
          console.error("fs_restore failed:", e);
        }
      }
      await Promise.all([...parents].map((parent) => fetchChildren(parent)));
    },
    [fetchChildren],
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
