function normalizeRepoPath(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function wouldCheckoutReloadDevApp(
  repoRoot: string | null | undefined,
  appLaunchRoot: string | null | undefined,
  isDev: boolean,
): boolean {
  if (!isDev) return false;
  const normalizedRepoRoot = normalizeRepoPath(repoRoot);
  const normalizedAppLaunchRoot = normalizeRepoPath(appLaunchRoot);
  if (!normalizedRepoRoot || !normalizedAppLaunchRoot) return false;
  return normalizedRepoRoot === normalizedAppLaunchRoot;
}
