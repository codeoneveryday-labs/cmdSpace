import { canMovePathsTo, removeDescendants } from "./selection";

export function prepareMovePaths(
  paths: string[],
  destination: string,
): string[] | null {
  const sources = removeDescendants(paths).filter(
    (source) => parentPath(source) !== destination,
  );
  if (sources.length === 0 || !canMovePathsTo(sources, destination)) return null;
  return sources;
}

function parentPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? normalized : normalized.slice(0, index);
}
