import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { resolveFolderCommand } from "./workspaceSetupModel";

export function useWorkspaceSetupFolder({
  workingFolder,
  selectedFolder,
  folderCommand,
  setSelectedFolder,
  setFolderCommand,
}: {
  workingFolder: string | null;
  selectedFolder: string;
  folderCommand: string;
  setSelectedFolder: (folder: string) => void;
  setFolderCommand: (command: string) => void;
}) {
  useEffect(() => {
    setSelectedFolder(workingFolder ?? "");
    setFolderCommand("");
  }, [setFolderCommand, setSelectedFolder, workingFolder]);

  const handleBrowse = useCallback(async () => {
    try {
      const result = await invoke<string | null>("select_folder");
      if (result) setSelectedFolder(result);
    } catch (error) {
      console.error("Failed to select folder:", error);
    }
  }, [setSelectedFolder]);

  const handleApplyFolderCommand = useCallback(() => {
    const nextFolder = resolveFolderCommand(folderCommand, selectedFolder);
    if (!nextFolder) return;
    setSelectedFolder(nextFolder);
    setFolderCommand("");
  }, [folderCommand, selectedFolder, setFolderCommand, setSelectedFolder]);

  return { handleBrowse, handleApplyFolderCommand };
}
