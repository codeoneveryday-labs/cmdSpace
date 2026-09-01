import { useMemo } from "react";
import type { SearchAddon } from "@xterm/addon-search";
import type { EditorPaneHandle } from "@/modules/editor";
import type { GitHistorySearchHandle } from "@/modules/git-history";
import type { SearchTarget } from "@/modules/header";
import type { TerminalPaneHandle } from "@/modules/terminal";

export function useAppSearchTarget({
  isTerminalTab,
  isEditorTab,
  isGitHistoryTab,
  activeLeafId,
  activeSearchAddon,
  activeEditorHandle,
  gitHistoryHandle,
  terminalRefs,
}: {
  isTerminalTab: boolean;
  isEditorTab: boolean;
  isGitHistoryTab: boolean;
  activeLeafId: number | null;
  activeSearchAddon: SearchAddon | null;
  activeEditorHandle: EditorPaneHandle | null;
  gitHistoryHandle: GitHistorySearchHandle | null;
  terminalRefs: ReadonlyMap<number, TerminalPaneHandle>;
}) {
  return useMemo<SearchTarget>(() => {
    if (isTerminalTab && activeLeafId !== null && activeSearchAddon) {
      return {
        kind: "terminal",
        addon: activeSearchAddon,
        focus: () => terminalRefs.get(activeLeafId)?.focus(),
      };
    }
    if (isEditorTab && activeEditorHandle) {
      return { kind: "editor", handle: activeEditorHandle, focus: () => activeEditorHandle.focus() };
    }
    if (isGitHistoryTab && gitHistoryHandle) {
      return { kind: "git-history", handle: gitHistoryHandle, focus: () => {} };
    }
    return null;
  }, [
    activeEditorHandle,
    activeLeafId,
    activeSearchAddon,
    gitHistoryHandle,
    isEditorTab,
    isGitHistoryTab,
    isTerminalTab,
    terminalRefs,
  ]);
}
