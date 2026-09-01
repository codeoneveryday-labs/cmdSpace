export type RemoteFolder = {
  name: string;
  path: string;
};

export type RemoteFile = {
  name: string;
  path: string;
  parent: string;
};

export type RemoteFolderState = {
  current: string;
  parent?: string | null;
  folders: RemoteFolder[];
  files: RemoteFile[];
};

export function getRemoteFolderView(
  state: RemoteFolderState | null,
  query: string,
) {
  const normalizedSearch = query.trim().toLowerCase();
  const folders = state?.folders.filter((folder) =>
    folder.name.toLowerCase().includes(normalizedSearch),
  ) ?? [];
  const files = state?.files.filter((file) =>
    file.name.toLowerCase().includes(normalizedSearch),
  ) ?? [];
  return {
    normalizedSearch,
    folders,
    files,
    isEmpty: folders.length === 0 && files.length === 0,
  };
}
