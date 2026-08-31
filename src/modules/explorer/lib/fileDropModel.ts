import { dirname } from "./fileTreePaths";

type Entry = { path: string; isDir: boolean };

export function resolveDropDestination(
  targetPath: string | undefined,
  targetIsDir: boolean | undefined,
  focusedPath: string | null,
  entries: ReadonlyMap<string, Entry>,
  rootPath: string | null,
): string {
  if (targetPath) return targetIsDir ? targetPath : dirname(targetPath);
  if (focusedPath) {
    const entry = entries.get(focusedPath);
    if (entry) return entry.isDir ? entry.path : dirname(entry.path);
  }
  return rootPath ?? "";
}
