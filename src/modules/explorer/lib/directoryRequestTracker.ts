type DirectoryRequest = {
  path: string;
  requestGeneration: number;
  treeGeneration: number;
};

export function createDirectoryRequestTracker() {
  let treeGeneration = 0;
  const latestRequestByPath = new Map<string, number>();

  return {
    begin(path: string): DirectoryRequest {
      const requestGeneration = (latestRequestByPath.get(path) ?? 0) + 1;
      latestRequestByPath.set(path, requestGeneration);
      return { path, requestGeneration, treeGeneration };
    },

    reset() {
      treeGeneration += 1;
      latestRequestByPath.clear();
    },

    isCurrent(request: DirectoryRequest) {
      return (
        request.treeGeneration === treeGeneration &&
        latestRequestByPath.get(request.path) === request.requestGeneration
      );
    },
  };
}
