import type { Tab } from "@/modules/tabs";

export type EditorPathPatch = { id: number; path: string; title: string };
export type DeletedEditorTabs = { dirty: number[]; clean: number[] };

function fileName(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

export function editorPathPatches(
  tabs: readonly Tab[],
  from: string,
  to: string,
): EditorPathPatch[] {
  return tabs.flatMap((tab) => {
    if (tab.kind !== "editor") return [];
    if (tab.path === from) return [{ id: tab.id, path: to, title: fileName(to) }];
    if (!tab.path.startsWith(`${from}/`)) return [];
    const path = `${to}${tab.path.slice(from.length)}`;
    return [{ id: tab.id, path, title: fileName(path) }];
  });
}

export function partitionDeletedEditorTabs(
  tabs: readonly Tab[],
  deletedPath: string,
): DeletedEditorTabs {
  const dirty: number[] = [];
  const clean: number[] = [];
  for (const tab of tabs) {
    if (tab.kind !== "editor") continue;
    if (tab.path !== deletedPath && !tab.path.startsWith(`${deletedPath}/`)) continue;
    (tab.dirty ? dirty : clean).push(tab.id);
  }
  return { dirty, clean };
}
