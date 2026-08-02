export const INTERNAL_PATHS_MIME = "application/x-cmdspace-paths";

type Point = { x: number; y: number };
type ClipboardDataReader = Pick<DataTransfer, "getData">;

export function hasExceededDragThreshold(start: Point, current: Point): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) > 5;
}

export function readInternalPaths(dataTransfer: ClipboardDataReader): string[] {
  const serialized = dataTransfer.getData(INTERNAL_PATHS_MIME);
  if (!serialized) return [];
  try {
    const paths = JSON.parse(serialized) as unknown;
    return Array.isArray(paths) &&
      paths.every((candidate) => typeof candidate === "string")
      ? paths
      : [];
  } catch {
    return [];
  }
}
