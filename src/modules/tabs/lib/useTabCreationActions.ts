import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import {
  createPaneTree,
  type SavedPaneInfo,
} from "./tabPaneModel";
import {
  createAgentChatTab,
  createArchitectureTab,
  createTerminalTab,
  createWorkspaceTab,
} from "./tabFactories";
import { openMarkdownTabState } from "./markdownTabTransitions";
import type { ArchitectureDiagram, Tab } from "./tabTypes";

export function useTabCreationActions({
  nextIdRef,
  setTabs,
  setActiveId,
}: {
  nextIdRef: MutableRefObject<number>;
  setTabs: Dispatch<SetStateAction<Tab[]>>;
  setActiveId: Dispatch<SetStateAction<number>>;
}) {
  const newTab = useCallback((cwd?: string, initialCommand?: string, title = "shell") => {
    const tabId = nextIdRef.current++;
    const leafId = nextIdRef.current++;
    setTabs((tabs) => [
      ...tabs,
      createTerminalTab({ id: tabId, leafId, cwd, title, initialCommand }),
    ]);
    setActiveId(tabId);
    return tabId;
  }, [nextIdRef, setActiveId, setTabs]);

  const newPrivateTab = useCallback((cwd?: string) => {
    const tabId = nextIdRef.current++;
    const leafId = nextIdRef.current++;
    setTabs((tabs) => [
      ...tabs,
      createTerminalTab({ id: tabId, leafId, cwd, title: "private", privateTab: true }),
    ]);
    setActiveId(tabId);
    return tabId;
  }, [nextIdRef, setActiveId, setTabs]);

  const newWorkspaceTab = useCallback(
    (
      cwd: string | undefined,
      paneCount: number,
      panes?: SavedPaneInfo[],
      paneLayout?: string | null,
      title = "workspace",
    ) => {
      const tabId = nextIdRef.current++;
      const { paneTree, activeLeafId } = createPaneTree(
        paneCount,
        cwd,
        () => nextIdRef.current++,
        panes,
        paneLayout,
      );
      setTabs((tabs) => [
        ...tabs,
        createWorkspaceTab({ id: tabId, title, cwd, paneTree, activeLeafId }),
      ]);
      setActiveId(tabId);
      return tabId;
    }, [nextIdRef, setActiveId, setTabs],
  );

  const newAgentChatTab = useCallback((input: {
    title: string;
    provider: CliAgent;
    cwd: string;
    chatId?: string;
    nativeSessionId?: string | null;
    initialDraft?: string;
    initialHistoryAttachments?: AgentChatHistoryAttachment[];
  }) => {
    const id = nextIdRef.current++;
    setTabs((tabs) => [...tabs, createAgentChatTab({ id, ...input })]);
    setActiveId(id);
    return id;
  }, [nextIdRef, setActiveId, setTabs]);

  const newMarkdownTab = useCallback((path: string) => {
    let targetId: number | null = null;
    setTabs((tabs) => {
      const result = openMarkdownTabState(tabs, path, () => nextIdRef.current++);
      targetId = result.targetId;
      return result.tabs;
    });
    if (targetId !== null) setActiveId(targetId);
    return targetId;
  }, [nextIdRef, setActiveId, setTabs]);

  const newArchitectureTab = useCallback(
    (diagram?: ArchitectureDiagram, title = "Architecture") => {
      const id = nextIdRef.current++;
      setTabs((tabs) => [...tabs, createArchitectureTab(id, diagram, title)]);
      setActiveId(id);
      return id;
    },
    [nextIdRef, setActiveId, setTabs],
  );

  return {
    newTab,
    newPrivateTab,
    newWorkspaceTab,
    newAgentChatTab,
    newMarkdownTab,
    newArchitectureTab,
  };
}
