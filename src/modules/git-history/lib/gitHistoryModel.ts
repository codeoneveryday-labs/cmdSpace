import type { GitLogEntry } from "@/modules/ai/lib/native";

export function filterGitCommits(
  commits: GitLogEntry[],
  query: string,
): GitLogEntry[] {
  const needle = query.toLowerCase();
  if (!needle) return commits;
  return commits.filter((commit) =>
    commit.subject.toLowerCase().includes(needle) ||
    commit.author.toLowerCase().includes(needle) ||
    commit.authorEmail.toLowerCase().includes(needle) ||
    commit.shortSha.includes(needle),
  );
}

export function mergeGitCommits(
  previous: GitLogEntry[],
  next: GitLogEntry[],
): GitLogEntry[] {
  const seen = new Set(previous.map((commit) => commit.sha));
  const merged = [...previous];
  for (const commit of next) {
    if (!seen.has(commit.sha)) {
      seen.add(commit.sha);
      merged.push(commit);
    }
  }
  return merged;
}
