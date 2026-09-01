import { useCallback, type MutableRefObject } from "react";
import { developerVocabularyFromWorkspace } from "@/modules/ai/lib/developerVocabulary";
import { native } from "@/modules/ai/lib/native";
import type { CanvasTerminalHandle } from "@/modules/architecture/CanvasTerminalNode";
import type { TerminalPaneHandle } from "@/modules/terminal";
import type { Tab } from "@/modules/tabs";
import { leafIds } from "@/modules/terminal/lib/panes";
import type { SpeechInputTarget } from "@/modules/ai/components/FloatingVoiceAgent";

type AppVoiceIntegrationProps = {
  activeId: number;
  activeWorkspaceFolder: string | null;
  tabsRef: MutableRefObject<readonly Tab[]>;
  terminalRefs: MutableRefObject<Map<number, TerminalPaneHandle>>;
  canvasTerminalRefs: MutableRefObject<Map<string, CanvasTerminalHandle>>;
  activeCanvasTerminalIds: MutableRefObject<Map<number, string>>;
  pendingVoiceDraftsRef: MutableRefObject<Map<number, string>>;
  canvasTerminalRefKey: (tabId: number, terminalId: string) => string;
};

export function useAppVoiceIntegration({
  activeId,
  activeWorkspaceFolder,
  tabsRef,
  terminalRefs,
  canvasTerminalRefs,
  activeCanvasTerminalIds,
  pendingVoiceDraftsRef,
  canvasTerminalRefKey,
}: AppVoiceIntegrationProps) {
  const captureVoiceTarget = useCallback((): SpeechInputTarget | null => {
    const tab = tabsRef.current.find((item) => item.id === activeId);
    if (!tab) return null;
    if (tab.kind === "architecture") {
      const terminalId = activeCanvasTerminalIds.current.get(tab.id);
      if (!terminalId) return null;
      const terminal = canvasTerminalRefs.current.get(
        canvasTerminalRefKey(tab.id, terminalId),
      );
      const node = tab.diagram?.nodes.find(
        (item) => item.id === terminalId && item.kind === "terminal",
      );
      if (!terminal || !node) return null;
      return { kind: "canvas-terminal", tabId: tab.id, terminalId };
    }
    if (tab.kind !== "terminal" || tab.private) return null;
    if (!terminalRefs.current.has(tab.activeLeafId)) return null;
    return {
      kind: "terminal-pane",
      tabId: tab.id,
      terminalId: tab.activeLeafId,
    };
  }, [activeId, activeCanvasTerminalIds, canvasTerminalRefKey, canvasTerminalRefs, tabsRef, terminalRefs]);

  const captureVoiceVocabulary = useCallback(async (): Promise<string> => {
    if (!activeWorkspaceFolder) return "";
    const folder = activeWorkspaceFolder.replace(/[\\/]+$/, "");
    const names = ["package.json", "Cargo.toml", "go.mod", "pyproject.toml"];
    const manifests = await Promise.all(
      names.map(async (name) => {
        try {
          const result = await native.readFile(`${folder}/${name}`);
          return result.kind === "text" ? { name, content: result.content } : null;
        } catch {
          return null;
        }
      }),
    );
    return developerVocabularyFromWorkspace(
      activeWorkspaceFolder,
      manifests.filter(
        (manifest): manifest is { name: string; content: string } => manifest !== null,
      ),
    );
  }, [activeWorkspaceFolder]);

  const insertVoiceDraft = useCallback(
    (target: SpeechInputTarget, draft: string): boolean => {
      const tab = tabsRef.current.find((item) => item.id === target.tabId);
      const nextDraft = draft.replace(/[\r\n]+$/, "");
      if (!nextDraft) return false;
      if (target.kind === "canvas-terminal") {
        if (
          !tab ||
          tab.kind !== "architecture" ||
          !tab.diagram?.nodes.some(
            (item) => item.id === target.terminalId && item.kind === "terminal",
          )
        ) return false;
        const terminal = canvasTerminalRefs.current.get(
          canvasTerminalRefKey(target.tabId, target.terminalId),
        );
        if (!terminal || !terminal.replaceCurrentInput(nextDraft)) return false;
        terminal.focus();
        return true;
      }
      if (
        !tab ||
        tab.kind !== "terminal" ||
        tab.private ||
        !leafIds(tab.paneTree).includes(target.terminalId)
      ) return false;
      const terminal = terminalRefs.current.get(target.terminalId);
      if (!terminal || !terminal.replaceCurrentInput(nextDraft)) return false;
      pendingVoiceDraftsRef.current.set(target.terminalId, nextDraft);
      terminal.focus();
      return true;
    },
    [canvasTerminalRefKey, canvasTerminalRefs, pendingVoiceDraftsRef, tabsRef, terminalRefs],
  );

  return { captureVoiceTarget, captureVoiceVocabulary, insertVoiceDraft };
}
