import { useMemo } from "react";
import type { Tab } from "@/modules/tabs";
import type { WorkspaceRecord } from "./useWorkspaceController";

export function useAppActiveContext({
  tabs,
  workspaces,
  activeId,
}: {
  tabs: readonly Tab[];
  workspaces: readonly WorkspaceRecord[];
  activeId: number;
}) {
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeId),
    [activeId, tabs],
  );
  const activeWorkspace = useMemo(
    () =>
      workspaces.find(
        (workspace) =>
          workspace.tabId === activeId ||
          workspace.canvasTabId === activeId ||
          workspace.agentTabIds?.includes(activeId),
      ),
    [activeId, workspaces],
  );

  return {
    activeTab,
    activeWorkspace,
    activeWorkspaceId: activeWorkspace?.id ?? null,
    activeWorkspaceFolder: activeWorkspace?.workingFolder ?? null,
    isTerminalTab: activeTab?.kind === "terminal",
    isEditorTab: activeTab?.kind === "editor",
    isPreviewTab: activeTab?.kind === "preview",
    isMarkdownTab: activeTab?.kind === "markdown",
    isAiDiffTab: activeTab?.kind === "ai-diff",
    isGitDiffTab:
      activeTab?.kind === "git-diff" || activeTab?.kind === "git-commit-file",
    isGitHistoryTab: activeTab?.kind === "git-history",
    isArchitectureTab: activeTab?.kind === "architecture",
  };
}
