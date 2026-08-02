export function getSelectionRange(
  visiblePaths: string[],
  anchorPath: string,
  focusPath: string,
): string[] {
  const anchorIndex = visiblePaths.indexOf(anchorPath);
  const focusIndex = visiblePaths.indexOf(focusPath);
  if (anchorIndex < 0 || focusIndex < 0) return [focusPath];
  const start = Math.min(anchorIndex, focusIndex);
  const end = Math.max(anchorIndex, focusIndex);
  return visiblePaths.slice(start, end + 1);
}

export function removeDescendants(paths: string[]): string[] {
  return paths.filter(
    (path) =>
      !paths.some(
        (candidate) =>
          candidate !== path && path.startsWith(`${candidate}/`),
      ),
  );
}

export function canMovePathsTo(paths: string[], destination: string): boolean {
  return paths.every(
    (path) => destination !== path && !destination.startsWith(`${path}/`),
  );
}
