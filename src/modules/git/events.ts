export const GIT_REPO_CHANGED_EVENT = "cmdspace:git-repo-changed";

type GitRepoChangedDetail = {
  repoRoot: string;
};

export function emitGitRepoChanged(repoRoot: string): void {
  window.dispatchEvent(
    new CustomEvent<GitRepoChangedDetail>(GIT_REPO_CHANGED_EVENT, {
      detail: { repoRoot },
    }),
  );
}

export function gitRepoRootFromChangedEvent(event: Event): string | null {
  const detail = (event as CustomEvent<Partial<GitRepoChangedDetail>>).detail;
  return typeof detail?.repoRoot === "string" ? detail.repoRoot : null;
}

export function pathBelongsToRepo(
  path: string | null | undefined,
  repoRoot: string,
): boolean {
  if (!path) return false;
  return path === repoRoot || path.startsWith(`${repoRoot}/`);
}
