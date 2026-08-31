import type { useFileTree } from "./useFileTree";

export type Row =
  | {
      kind: "entry";
      key: string;
      path: string;
      name: string;
      isDir: boolean;
      isExpanded: boolean;
      depth: number;
    }
  | { kind: "rename"; key: string; path: string; name: string; isDir: boolean; depth: number }
  | { kind: "pending"; key: string; depth: number; pendingKind: "file" | "dir" }
  | { kind: "status"; key: string; depth: number; tone: "muted" | "error"; message: string };

export function buildRows(
  rootPath: string,
  tree: ReturnType<typeof useFileTree>,
): { rows: Row[]; entryIndexByPath: Map<string, number> } {
  const rows: Row[] = [];
  const entryIndexByPath = new Map<string, number>();

  const walk = (parent: string, depth: number) => {
    const node = tree.nodes[parent];
    if (!node || node.status !== "loaded") return;
    for (const entry of node.entries) {
      const path = tree.joinPath(parent, entry.name);
      const isDir = entry.kind === "dir";
      const expanded = isDir && tree.expanded.has(path);
      const isRenaming = tree.renaming === path;
      if (isRenaming) {
        rows.push({ kind: "rename", key: `rename:${path}`, path, name: entry.name, isDir, depth });
      } else {
        entryIndexByPath.set(path, rows.length);
        rows.push({ kind: "entry", key: path, path, name: entry.name, isDir, isExpanded: expanded, depth });
      }
      if (isDir && expanded) {
        const child = tree.nodes[path];
        if (tree.pendingCreate?.parentPath === path) {
          rows.push({ kind: "pending", key: `pending:${path}`, depth: depth + 1, pendingKind: tree.pendingCreate.kind });
        }
        if (child?.status === "loading") {
          rows.push({ kind: "status", key: `loading:${path}`, depth: depth + 1, tone: "muted", message: "Loading…" });
        } else if (child?.status === "error") {
          rows.push({ kind: "status", key: `error:${path}`, depth: depth + 1, tone: "error", message: child.message });
        } else if (child?.status === "loaded") {
          walk(path, depth + 1);
        }
      }
    }
  };

  walk(rootPath, 0);
  return { rows, entryIndexByPath };
}
