export type DirEntry = {
  name: string;
  kind: "file" | "dir" | "symlink";
  size: number;
  mtime: number;
};

export type ChildrenState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; entries: DirEntry[] }
  | { status: "error"; message: string };

export type TreeState = Record<string, ChildrenState>;

export type PendingCreate = {
  parentPath: string;
  kind: "file" | "dir";
};

export type FileTreeState = {
  nodes: TreeState;
  expanded: Set<string>;
  pendingCreate: PendingCreate | null;
  renaming: string | null;
};

export function emptyFileTreeState(): FileTreeState {
  return {
    nodes: {},
    expanded: new Set(),
    pendingCreate: null,
    renaming: null,
  };
}

export function loadedDirectoryPaths(nodes: TreeState): string[] {
  return Object.entries(nodes)
    .filter(([, state]) => state.status === "loaded")
    .map(([path]) => path);
}
