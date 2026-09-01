export function nextWorkspaceIndex(
  length: number,
  currentIndex: number,
  delta: 1 | -1,
): number | null {
  if (length < 2) return null;
  if (currentIndex < 0 || currentIndex >= length) {
    return delta === 1 ? 0 : length - 1;
  }
  return (currentIndex + delta + length) % length;
}
