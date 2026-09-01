import { createGitCommitFileDiffTab, createGitDiffTab, createGitHistoryTab } from "./tabFactories";
import type { Tab } from "./tabTypes";

export function openGitDiffState(tabs: readonly Tab[], input: { id: number; path: string; repoRoot: string; mode: "-" | "+"; originalPath: string | null; title?: string }): { tabs: Tab[]; targetId: number } {
  const existing = tabs.find((tab) => tab.kind === "git-diff" && tab.repoRoot === input.repoRoot && tab.path === input.path && tab.mode === input.mode);
  if (existing && existing.kind === "git-diff") {
    return { tabs: tabs.map((tab) => tab.id === existing.id ? { ...tab, title: input.title ?? existing.title, originalPath: input.originalPath } : tab), targetId: existing.id };
  }
  const tab = createGitDiffTab(input);
  return { tabs: [...tabs, tab], targetId: tab.id };
}

export function openGitHistoryState(tabs: readonly Tab[], input: { id: number; repoRoot: string; branch?: string | null }): { tabs: Tab[]; targetId: number } {
  const existing = tabs.find((tab) => tab.kind === "git-history" && tab.repoRoot === input.repoRoot);
  if (existing && existing.kind === "git-history") {
    return { tabs: tabs.map((tab) => tab.id === existing.id ? { ...tab, title: input.branch ? `History · ${input.branch}` : "Git History" } : tab), targetId: existing.id };
  }
  const tab = createGitHistoryTab(input.id, input.repoRoot, input.branch);
  return { tabs: [...tabs, tab], targetId: tab.id };
}

export function openGitCommitFileDiffState(tabs: readonly Tab[], input: { id: number; repoRoot: string; sha: string; shortSha: string; subject: string; path: string; originalPath: string | null }): { tabs: Tab[]; targetId: number } {
  const existing = tabs.find((tab) => tab.kind === "git-commit-file" && tab.repoRoot === input.repoRoot && tab.sha === input.sha && tab.path === input.path);
  const title = `${basename(input.path)} @ ${input.shortSha}`;
  if (existing && existing.kind === "git-commit-file") {
    return { tabs: tabs.map((tab) => tab.id === existing.id ? { ...tab, title, subject: input.subject, originalPath: input.originalPath } : tab), targetId: existing.id };
  }
  const tab = createGitCommitFileDiffTab(input);
  return { tabs: [...tabs, tab], targetId: tab.id };
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}
