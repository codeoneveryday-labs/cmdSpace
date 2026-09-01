import { useEffect, type MutableRefObject } from "react";
import type { Tab } from "@/modules/tabs";

export function useBootstrapTabCleanup({
  activeWorkspaceId,
  tabs,
  pendingBootstrapCloseRef,
  closeTab,
}: {
  activeWorkspaceId: string | null;
  tabs: readonly Tab[];
  pendingBootstrapCloseRef: MutableRefObject<boolean>;
  closeTab: (tabId: number) => void;
}): void {
  useEffect(() => {
    if (!pendingBootstrapCloseRef.current || activeWorkspaceId === null) return;
    const bootstrapTab = tabs.find(
      (tab) => tab.id === 1 && tab.title === "shell",
    );
    if (bootstrapTab && tabs.length > 1) closeTab(bootstrapTab.id);
    pendingBootstrapCloseRef.current = false;
  }, [activeWorkspaceId, closeTab, pendingBootstrapCloseRef, tabs]);
}
