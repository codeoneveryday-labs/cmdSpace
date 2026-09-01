import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Tab } from "@/modules/tabs";

export function useAppTabClose({
  tabs,
  disposeTab,
  pendingCloseTab,
  setPendingCloseTab,
}: {
  tabs: readonly Tab[];
  disposeTab: (tabId: number) => void;
  pendingCloseTab: number | null;
  setPendingCloseTab: Dispatch<SetStateAction<number | null>>;
}) {
  const handleClose = useCallback(
    (id: number) => {
      const tab = tabs.find((item) => item.id === id);
      if (tab?.kind === "editor" && tab.dirty) {
        setPendingCloseTab(id);
        return;
      }
      disposeTab(id);
    },
    [disposeTab, setPendingCloseTab, tabs],
  );

  const confirmClose = useCallback(() => {
    if (pendingCloseTab === null) return;
    disposeTab(pendingCloseTab);
    setPendingCloseTab(null);
  }, [disposeTab, pendingCloseTab, setPendingCloseTab]);

  const cancelClose = useCallback(() => {
    setPendingCloseTab(null);
  }, [setPendingCloseTab]);

  return { handleClose, confirmClose, cancelClose };
}
