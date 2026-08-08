export const DEFAULT_EXCLUDED_FOLDER_NAMES = [
  ".git",
  "node_modules",
  "dist",
  "target",
] as const;

export function normalizeExcludedFolderNames(
  values: readonly string[],
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const name = value.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    normalized.push(name);
  }
  return normalized;
}

export function parseExcludedFolderNames(value: string): string[] {
  return normalizeExcludedFolderNames(value.split(/[,\n]/));
}

export function filterExcludedFolders<
  T extends { name: string; kind: string },
>(entries: readonly T[], excludedNames: readonly string[]): T[] {
  const excluded = new Set(normalizeExcludedFolderNames(excludedNames));
  return entries.filter(
    (entry) => entry.kind !== "dir" || !excluded.has(entry.name),
  );
}
