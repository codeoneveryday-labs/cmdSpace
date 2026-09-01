import { useEffect, type MutableRefObject } from "react";
import type { SearchAddon } from "@xterm/addon-search";
import type { TerminalPaneHandle } from "@/modules/terminal";
import { disposeSession } from "@/modules/terminal";
import type { Tab } from "@/modules/tabs";
import { leafIds } from "@/modules/terminal/lib/panes";

export function useLiveTerminalCleanup({
  tabs,
  liveLeavesRef,
  terminalRefs,
  searchAddons,
}: {
  tabs: readonly Tab[];
  liveLeavesRef: MutableRefObject<Set<number>>;
  terminalRefs: MutableRefObject<Map<number, TerminalPaneHandle>>;
  searchAddons: MutableRefObject<Map<number, SearchAddon>>;
}): void {
  useEffect(() => {
    const live = new Set<number>();
    for (const tab of tabs) {
      if (tab.kind === "terminal") {
        for (const id of leafIds(tab.paneTree)) live.add(id);
      }
    }
    for (const id of liveLeavesRef.current) {
      if (!live.has(id)) disposeSession(id);
    }
    liveLeavesRef.current = live;
    for (const key of [...terminalRefs.current.keys()]) {
      if (!live.has(key)) terminalRefs.current.delete(key);
    }
    for (const key of [...searchAddons.current.keys()]) {
      if (!live.has(key)) searchAddons.current.delete(key);
    }
  }, [tabs, liveLeavesRef, terminalRefs, searchAddons]);
}
