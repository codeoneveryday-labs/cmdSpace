import { invoke, isTauri } from "@tauri-apps/api/core";
import { useCallback } from "react";
import {
  INTERNAL_PATHS_MIME,
  readInternalPaths,
} from "./internalDrag";
import { removeDescendants } from "./selection";

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.isContentEditable ||
      element?.closest("input, textarea, [contenteditable=true]"),
  );
}

export function useFileExplorerClipboard({
  selectedPaths,
  resolveDestination,
  importPaths,
  importBrowserFiles,
}: {
  selectedPaths: string[];
  resolveDestination: () => string;
  importPaths: (paths: string[], destination: string) => Promise<unknown>;
  importBrowserFiles: (files: File[], destination: string) => Promise<unknown>;
}) {
  const handleCopy = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target) || selectedPaths.length === 0) return;
      const paths = removeDescendants(selectedPaths);
      event.preventDefault();
      event.clipboardData.setData(INTERNAL_PATHS_MIME, JSON.stringify(paths));
      event.clipboardData.setData("text/plain", paths.join("\n"));
    },
    [selectedPaths],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target)) return;
      const internalPaths = readInternalPaths(event.clipboardData);
      if (internalPaths.length > 0) {
        event.preventDefault();
        void importPaths(internalPaths, resolveDestination()).catch((error) => {
          console.error("copy files failed:", error);
        });
        return;
      }
      const files = Array.from(event.clipboardData.files);
      if (files.length > 0) {
        event.preventDefault();
        void importBrowserFiles(files, resolveDestination()).catch((error) => {
          console.error("paste files failed:", error);
        });
        return;
      }
      if (!isTauri()) return;
      event.preventDefault();
      const destination = resolveDestination();
      void invoke<string[]>("fs_clipboard_paths")
        .then((paths) => {
          if (paths.length === 0) return;
          return importPaths(paths, destination);
        })
        .catch((error) => {
          console.error("paste native files failed:", error);
        });
    },
    [importBrowserFiles, importPaths, resolveDestination],
  );

  return { handleCopy, handlePaste };
}
