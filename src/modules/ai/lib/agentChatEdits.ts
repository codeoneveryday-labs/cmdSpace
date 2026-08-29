import type { GitChangedFile, GitPanelSnapshot } from "./native";

export type AgentEditFile = {
  path: string;
  originalPath: string | null;
  repoRoot: string;
  added: number;
  removed: number;
  untracked: boolean;
};

export type AgentEditBaseline = {
  repoRoot: string;
  changedPaths: ReadonlySet<string>;
};

export function createAgentEditBaseline(
  snapshot: GitPanelSnapshot,
): AgentEditBaseline | null {
  if (!snapshot.repo || !snapshot.status) return null;
  return {
    repoRoot: snapshot.repo.repoRoot,
    changedPaths: new Set(snapshot.status.changedFiles.map((file) => file.path)),
  };
}

export function filesChangedByAgent(
  baseline: AgentEditBaseline | null,
  snapshot: GitPanelSnapshot,
): GitChangedFile[] {
  if (!snapshot.repo || !snapshot.status) return [];
  if (baseline && baseline.repoRoot !== snapshot.repo.repoRoot) return [];
  return snapshot.status.changedFiles.filter(
    (file) => !baseline?.changedPaths.has(file.path),
  );
}

export function countDiffLines(patch: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) added += 1;
    if (line.startsWith("-")) removed += 1;
  }
  return { added, removed };
}

export function countTextLines(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}
