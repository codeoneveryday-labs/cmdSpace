import type { AiDiffStatus, Tab } from "./tabTypes";
import { createAiDiffTab } from "./tabFactories";

export function openAiDiffState(
  tabs: readonly Tab[],
  input: {
    path: string;
    originalContent: string;
    proposedContent: string;
    approvalId: string;
    isNewFile: boolean;
  },
  nextId: () => number,
): { tabs: Tab[]; targetId: number } {
  const existing = tabs.find(
    (tab) => tab.kind === "ai-diff" && tab.approvalId === input.approvalId,
  );
  if (existing) return { tabs: [...tabs], targetId: existing.id };
  const tab = createAiDiffTab({ ...input, id: nextId() });
  return { tabs: [...tabs, tab], targetId: tab.id };
}

export function closeAiDiffState(
  tabs: readonly Tab[],
  activeId: number,
  approvalId: string,
): { tabs: Tab[]; activeId: number } {
  const target = tabs.find(
    (tab) => tab.kind === "ai-diff" && tab.approvalId === approvalId,
  );
  if (!target || target.kind !== "ai-diff") return { tabs: [...tabs], activeId };
  if (tabs.length <= 1) {
    return {
      tabs: tabs.map((tab) =>
        tab.kind === "ai-diff" && tab.approvalId === approvalId
          ? { ...tab, status: "approved" as AiDiffStatus }
          : tab,
      ),
      activeId,
    };
  }
  const index = tabs.findIndex((tab) => tab.id === target.id);
  const nextTabs = tabs.filter((tab) => tab.id !== target.id);
  return {
    tabs: nextTabs,
    activeId: target.id === activeId
      ? nextTabs[Math.max(0, index - 1)].id
      : activeId,
  };
}

export function updateAiDiffStatus(
  tabs: readonly Tab[],
  approvalId: string,
  status: AiDiffStatus,
): Tab[] {
  return tabs.map((tab) =>
    tab.kind === "ai-diff" && tab.approvalId === approvalId
      ? { ...tab, status }
      : tab,
  );
}
