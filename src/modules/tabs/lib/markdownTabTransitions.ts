import { createMarkdownTab } from "./tabFactories";
import type { Tab } from "./tabTypes";

export function openMarkdownTabState(
  tabs: readonly Tab[],
  path: string,
  nextId: () => number,
): { tabs: Tab[]; targetId: number } {
  const existing = tabs.find((tab) => tab.kind === "markdown" && tab.path === path);
  if (existing) return { tabs: [...tabs], targetId: existing.id };
  const tab = createMarkdownTab(nextId(), path);
  return { tabs: [...tabs, tab], targetId: tab.id };
}
