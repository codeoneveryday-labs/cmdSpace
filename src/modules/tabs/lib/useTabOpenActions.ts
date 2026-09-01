import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  closeAiDiffState,
  openAiDiffState,
  updateAiDiffStatus,
} from "./aiDiffTransitions";
import { openEditorTabState, promoteEditorTab } from "./editorTabTransitions";
import {
  openGitCommitFileDiffState,
  openGitDiffState,
  openGitHistoryState,
} from "./gitTabTransitions";
import { applyTabPatch } from "./tabPatchModel";
import type { AiDiffStatus, Tab, TabPatch } from "./tabTypes";

export function useTabOpenActions({
  tabsRef,
  nextIdRef,
  setTabs,
  setActiveId,
}: {
  tabsRef: MutableRefObject<Tab[]>;
  nextIdRef: MutableRefObject<number>;
  setTabs: Dispatch<SetStateAction<Tab[]>>;
  setActiveId: Dispatch<SetStateAction<number>>;
}) {
  const openFileTab = useCallback((path: string, pin = true) => {
    let targetId: number | null = null;
    setTabs((tabs) => {
      const result = openEditorTabState(tabs, path, pin, () => nextIdRef.current++);
      targetId = result.targetId;
      return result.tabs;
    });
    if (targetId !== null) setActiveId(targetId);
    return targetId as number | null;
  }, [nextIdRef, setActiveId, setTabs]);

  const pinTab = useCallback((id: number) => {
    setTabs((tabs) => promoteEditorTab(tabs, id));
  }, [setTabs]);

  const openAiDiffTab = useCallback(
    (input: {
      path: string;
      originalContent: string;
      proposedContent: string;
      approvalId: string;
      isNewFile: boolean;
    }) => {
      let targetId: number | null = null;
      setTabs((tabs) => {
        const result = openAiDiffState(tabs, input, () => nextIdRef.current++);
        targetId = result.targetId;
        return result.tabs;
      });
      if (targetId !== null) setActiveId(targetId);
      return targetId as number | null;
    },
    [nextIdRef, setActiveId, setTabs],
  );

  const setAiDiffStatus = useCallback(
    (approvalId: string, status: AiDiffStatus) => {
      setTabs((tabs) => updateAiDiffStatus(tabs, approvalId, status));
    },
    [setTabs],
  );

  const closeAiDiffTab = useCallback((approvalId: string) => {
    setTabs((tabs) => {
      const result = closeAiDiffState(tabs, -1, approvalId);
      if (
        result.tabs.length === tabs.length &&
        result.tabs.every((tab, index) => tab === tabs[index])
      ) {
        return tabs;
      }
      setActiveId((active) => closeAiDiffState(tabs, active, approvalId).activeId);
      return result.tabs;
    });
  }, [setActiveId, setTabs]);

  const openGitDiffTab = useCallback(
    (input: {
      path: string;
      repoRoot: string;
      mode: "-" | "+";
      originalPath?: string | null;
      title?: string;
    }) => {
      const current = tabsRef.current;
      const result = openGitDiffState(current, {
        ...input,
        id: nextIdRef.current++,
        originalPath: input.originalPath ?? null,
      });
      tabsRef.current = result.tabs;
      setTabs(result.tabs);
      setActiveId(result.targetId);
      return result.targetId;
    },
    [nextIdRef, setActiveId, setTabs, tabsRef],
  );

  const openCommitHistoryTab = useCallback(
    (input: { repoRoot: string; branch?: string | null }) => {
      const current = tabsRef.current;
      const result = openGitHistoryState(current, {
        ...input,
        id: nextIdRef.current++,
      });
      tabsRef.current = result.tabs;
      setTabs(result.tabs);
      setActiveId(result.targetId);
      return result.targetId;
    },
    [nextIdRef, setActiveId, setTabs, tabsRef],
  );

  const openCommitFileDiffTab = useCallback(
    (input: {
      repoRoot: string;
      sha: string;
      shortSha: string;
      subject: string;
      path: string;
      originalPath: string | null;
    }) => {
      const current = tabsRef.current;
      const result = openGitCommitFileDiffState(current, {
        ...input,
        id: nextIdRef.current++,
      });
      tabsRef.current = result.tabs;
      setTabs(result.tabs);
      setActiveId(result.targetId);
      return result.targetId;
    },
    [nextIdRef, setActiveId, setTabs, tabsRef],
  );

  const updateTab = useCallback(
    (id: number, patch: TabPatch) => {
      setTabs((tabs) =>
        tabs.map((tab) => (tab.id === id ? applyTabPatch(tab, patch) : tab)),
      );
    },
    [setTabs],
  );

  return {
    openFileTab,
    pinTab,
    openAiDiffTab,
    setAiDiffStatus,
    closeAiDiffTab,
    openGitDiffTab,
    openCommitHistoryTab,
    openCommitFileDiffTab,
    updateTab,
  };
}
