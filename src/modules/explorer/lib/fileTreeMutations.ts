import { canMovePathsTo, removeDescendants } from "./selection";
import { dirname, joinPath } from "./fileTreePaths";

export type DeletedPath = {
  path: string;
  token: string;
};

export type FileTreeMutationPort = {
  invoke: (command: string, payload: Record<string, unknown>) => Promise<unknown>;
  refresh: (path: string) => Promise<void>;
  workspace: () => unknown;
  onPathRenamed?: (from: string, to: string) => void;
  onPathDeleted?: (path: string) => void;
  onDeleteCommitted?: (records: DeletedPath[]) => void;
  reportError?: (command: string, error: unknown) => void;
};

export function createFileTreeMutations(port: FileTreeMutationPort) {
  const payload = (values: Record<string, unknown>) => ({
    ...values,
    workspace: port.workspace(),
  });
  const reportError = (command: string, error: unknown) => {
    if (port.reportError) port.reportError(command, error);
    else console.error(`${command} failed:`, error);
  };

  return {
    async create(parentPath: string, kind: "file" | "dir", name: string) {
      const path = joinPath(parentPath, name);
      const command = kind === "dir" ? "fs_create_dir" : "fs_create_file";
      try {
        await port.invoke(command, payload({ path }));
        await port.refresh(parentPath);
      } catch (error) {
        reportError(command, error);
      }
    },

    async rename(from: string, name: string) {
      const to = joinPath(dirname(from), name);
      try {
        await port.invoke("fs_rename", payload({ from, to }));
        port.onPathRenamed?.(from, to);
        await port.refresh(dirname(from));
      } catch (error) {
        reportError("fs_rename", error);
      }
    },

    async deletePath(path: string) {
      try {
        const record = (await port.invoke("fs_delete", payload({ path }))) as DeletedPath;
        port.onPathDeleted?.(path);
        port.onDeleteCommitted?.([record]);
        await port.refresh(dirname(path));
      } catch (error) {
        reportError("fs_delete", error);
      }
    },

    async deletePaths(paths: string[]) {
      const records: DeletedPath[] = [];
      const parents = new Set<string>();
      for (const path of removeDescendants(paths)) {
        try {
          const record = (await port.invoke("fs_delete", payload({ path }))) as DeletedPath;
          port.onPathDeleted?.(path);
          records.push(record);
          parents.add(dirname(path));
        } catch (error) {
          reportError("fs_delete", error);
        }
      }
      if (records.length > 0) port.onDeleteCommitted?.(records);
      await Promise.all([...parents].map((parent) => port.refresh(parent)));
    },

    async movePaths(paths: string[], destination: string) {
      const sources = removeDescendants(paths);
      if (!canMovePathsTo(sources, destination)) {
        throw new Error("A folder cannot be moved into itself.");
      }

      const refreshPaths = new Set<string>([destination]);
      for (const from of sources) {
        const to = joinPath(destination, from.slice(from.lastIndexOf("/") + 1));
        await port.invoke("fs_rename", payload({ from, to }));
        port.onPathRenamed?.(from, to);
        refreshPaths.add(dirname(from));
      }
      await Promise.all([...refreshPaths].map((path) => port.refresh(path)));
    },

    async importPaths(sources: string[], destination: string) {
      const imported = (await port.invoke(
        "fs_import_paths",
        payload({ sources, destination }),
      )) as string[];
      await port.refresh(destination);
      return imported;
    },

    async importClipboardFile(name: string, dataBase64: string, destination: string) {
      const imported = (await port.invoke(
        "fs_import_clipboard_file",
        payload({ name, dataBase64, destination }),
      )) as string;
      await port.refresh(destination);
      return imported;
    },

    async restorePaths(records: DeletedPath[]) {
      const parents = new Set<string>();
      const ordered = [...records].sort((left, right) => left.path.length - right.path.length);
      for (const record of ordered) {
        try {
          await port.invoke(
            "fs_restore",
            payload({ path: record.path, token: record.token }),
          );
          parents.add(dirname(record.path));
        } catch (error) {
          reportError("fs_restore", error);
        }
      }
      await Promise.all([...parents].map((parent) => port.refresh(parent)));
    },
  };
}
