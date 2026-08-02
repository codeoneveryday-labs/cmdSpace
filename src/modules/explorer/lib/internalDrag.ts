export const INTERNAL_PATHS_MIME = "application/x-cmdspace-paths";
export const INTERNAL_PATHS_TEXT_PREFIX = "cmdspace-paths:";

type DragDataReader = Pick<DataTransfer, "getData" | "types">;
type DragDataWriter = Pick<DataTransfer, "setData">;

function parsePaths(serialized: string): string[] {
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

export function writeInternalPaths(
  dataTransfer: DragDataWriter,
  paths: string[],
): void {
  const serialized = JSON.stringify(paths);
  dataTransfer.setData(INTERNAL_PATHS_MIME, serialized);
  dataTransfer.setData("text/plain", `${INTERNAL_PATHS_TEXT_PREFIX}${serialized}`);
}

export function hasInternalPathType(dataTransfer: DragDataReader): boolean {
  const types = Array.from(dataTransfer.types);
  return types.includes(INTERNAL_PATHS_MIME) || types.includes("text/plain");
}

export function readInternalPaths(dataTransfer: DragDataReader): string[] {
  const customPaths = parsePaths(dataTransfer.getData(INTERNAL_PATHS_MIME));
  if (customPaths.length > 0) return customPaths;

  const text = dataTransfer.getData("text/plain");
  if (!text.startsWith(INTERNAL_PATHS_TEXT_PREFIX)) return [];
  return parsePaths(text.slice(INTERNAL_PATHS_TEXT_PREFIX.length));
}
