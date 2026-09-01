import type { Tab } from "./tabTypes";
import { createEditorTab } from "./tabFactories";

export function openEditorTabState(
  tabs: readonly Tab[],
  path: string,
  pin: boolean,
  nextId: () => number,
): { tabs: Tab[]; targetId: number | null } {
  if (pin) {
    const existing = tabs.find((tab) => tab.kind === "editor" && tab.path === path);
    if (existing) {
      return {
        tabs: (existing.kind === "editor" && existing.preview)
          ? tabs.map((tab) => tab.id === existing.id ? { ...tab, preview: false } : tab)
          : [...tabs],
        targetId: existing.id,
      };
    }
    const id = nextId();
    return { tabs: [...tabs, createEditorTab({ id, path, preview: false })], targetId: id };
  }
  const persistent = tabs.find((tab) => tab.kind === "editor" && tab.path === path && !tab.preview);
  if (persistent) return { tabs: [...tabs], targetId: persistent.id };
  const existingPreview = tabs.find((tab) => tab.kind === "editor" && tab.path === path && tab.preview);
  if (existingPreview) return { tabs: [...tabs], targetId: existingPreview.id };
  const previewIndex = tabs.findIndex((tab) => tab.kind === "editor" && tab.preview);
  const tab = createEditorTab({ id: nextId(), path, preview: true });
  if (previewIndex < 0) return { tabs: [...tabs, tab], targetId: tab.id };
  const next = [...tabs];
  next[previewIndex] = tab;
  return { tabs: next, targetId: tab.id };
}

export function promoteEditorTab(tabs: readonly Tab[], id: number): Tab[] {
  return tabs.map((tab) =>
    tab.id === id && tab.kind === "editor" ? { ...tab, preview: false } : tab,
  );
}
