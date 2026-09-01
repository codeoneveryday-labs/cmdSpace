import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Tab } from "@/modules/tabs";
import { editorPathPatches, partitionDeletedEditorTabs } from "./editorPathModel";

export function useAppFileActions({
  tabs,
  openFileTab,
  updateTab,
  disposeTab,
  setPendingDeleteTabs,
}: {
  tabs: readonly Tab[];
  openFileTab: (path: string, pin: boolean) => void;
  updateTab: (tabId: number, patch: { path?: string; dirty?: boolean }) => void;
  disposeTab: (tabId: number) => void;
  setPendingDeleteTabs: Dispatch<SetStateAction<number[] | null>>;
}) {
  const handleOpenFile = useCallback(
    (path: string, pin?: boolean) => {
      // Explorer defaults to preview; explicit open actions pin the tab.
      openFileTab(path, pin ?? false);
    },
    [openFileTab],
  );

  const handlePathRenamed = useCallback(
    (from: string, to: string) => {
      for (const patch of editorPathPatches(tabs, from, to)) {
        updateTab(patch.id, patch);
      }
    },
    [tabs, updateTab],
  );

  const handlePathDeleted = useCallback(
    (path: string) => {
      const { dirty, clean } = partitionDeletedEditorTabs(tabs, path);
      for (const id of clean) disposeTab(id);
      if (dirty.length > 0) setPendingDeleteTabs(dirty);
    },
    [disposeTab, setPendingDeleteTabs, tabs],
  );

  return { handleOpenFile, handlePathRenamed, handlePathDeleted };
}
