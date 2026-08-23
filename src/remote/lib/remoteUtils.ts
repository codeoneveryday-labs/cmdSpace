export function remoteFolderName(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

export function remoteApiPath(path: string): string {
  return path;
}
