import type { Tab } from "@/modules/tabs";
import { findLeafCwd } from "@/modules/terminal/lib/panes";

export function resolveActiveTerminalLeafCwd(
  activeTab: Tab | undefined,
): string | null {
  if (activeTab?.kind !== "terminal") return null;
  return (
    findLeafCwd(activeTab.paneTree, activeTab.activeLeafId) ??
    activeTab.cwd ??
    null
  );
}

export function resolveActiveFilePath(activeTab: Tab | undefined): string | null {
  if (activeTab?.kind === "editor") return activeTab.path;
  if (activeTab?.kind === "git-diff") {
    if (/^([A-Za-z]:|\/|\\)/.test(activeTab.path)) return activeTab.path;
    const root = activeTab.repoRoot.replace(/[\\/]+$/, "");
    const relative = activeTab.path.replace(/^[\\/]+/, "");
    return `${root}/${relative}`;
  }
  if (activeTab?.kind === "git-commit-file") {
    const root = activeTab.repoRoot.replace(/[\\/]+$/, "");
    const relative = activeTab.path.replace(/^[\\/]+/, "");
    return `${root}/${relative}`;
  }
  return null;
}

export function resolveSourceControlContextPath(
  activeTab: Tab | undefined,
  activeTerminalLeafCwd: string | null,
  explorerRoot: string | null,
  workspaceFallbackPath: string | null,
): string | null {
  if (activeTab?.kind === "terminal") {
    return activeTerminalLeafCwd ?? explorerRoot ?? workspaceFallbackPath;
  }
  if (activeTab?.kind === "editor") return dirname(activeTab.path);
  if (
    activeTab?.kind === "git-diff" ||
    activeTab?.kind === "git-commit-file" ||
    activeTab?.kind === "git-history"
  ) {
    return activeTab.repoRoot;
  }
  return explorerRoot ?? workspaceFallbackPath;
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? normalized : normalized.slice(0, index);
}
