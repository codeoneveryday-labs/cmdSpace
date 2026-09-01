import { useMemo } from "react";
import type { Tab } from "@/modules/tabs";
import { resolveSourceControlContextPath } from "./appContextModel";

export function useAppSourceControlContext({
  activeTab,
  activeTerminalLeafCwd,
  explorerRoot,
  workspaceFallbackPath,
  tabs,
  sidebarView,
  editorSidebarView,
}: {
  activeTab: Tab | undefined;
  activeTerminalLeafCwd: string | null;
  explorerRoot: string | null;
  workspaceFallbackPath: string | null;
  tabs: readonly Tab[];
  sidebarView: string;
  editorSidebarView: string;
}) {
  const sourceControlContextPath = resolveSourceControlContextPath(
    activeTab,
    activeTerminalLeafCwd,
    explorerRoot,
    workspaceFallbackPath,
  );
  const hasOpenGitTab = useMemo(
    () =>
      tabs.some(
        (tab) =>
          tab.kind === "git-diff" ||
          tab.kind === "git-history" ||
          tab.kind === "git-commit-file",
      ),
    [tabs],
  );
  const sourceControlActive =
    hasOpenGitTab ||
    (sidebarView === "editor" && editorSidebarView === "source-control");
  const badgeContextPath = workspaceFallbackPath;
  const sourceControlPath = sourceControlActive
    ? sourceControlContextPath
    : badgeContextPath;

  return {
    sourceControlContextPath,
    sourceControlPath,
  };
}
