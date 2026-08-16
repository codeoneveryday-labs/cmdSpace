import { useCallback, useEffect, useMemo, useState } from "react";
import type { TerminalTab } from "@/modules/tabs";
import { leafIds } from "./panes";
import {
  registerBroadcastTab,
  unregisterBroadcastLeaves,
} from "./terminalBroadcastRuntime";

export type TerminalBroadcastState = {
  enabled: boolean;
  targetLeafIds: number[];
};

const defaultState = (tab: TerminalTab): TerminalBroadcastState => ({
  enabled: false,
  targetLeafIds: [tab.activeLeafId],
});

export function useTerminalCollaboration(terminals: TerminalTab[]) {
  const [broadcastByTab, setBroadcastByTab] = useState<
    Record<number, TerminalBroadcastState>
  >({});

  const terminalLeaves = useMemo(
    () =>
      terminals.map((tab) => ({
        tab,
        leafIds: leafIds(tab.paneTree),
      })),
    [terminals],
  );

  useEffect(() => {
    setBroadcastByTab((current) => {
      let changed = false;
      const next: Record<number, TerminalBroadcastState> = {};
      const liveTabIds = new Set(terminals.map((tab) => tab.id));

      for (const [tabIdText, state] of Object.entries(current)) {
        const tabId = Number(tabIdText);
        if (!liveTabIds.has(tabId)) {
          changed = true;
          continue;
        }
        const liveLeaves = new Set(
          terminalLeaves.find((entry) => entry.tab.id === tabId)?.leafIds ?? [],
        );
        const targetLeafIds = state.targetLeafIds.filter((leafId) =>
          liveLeaves.has(leafId),
        );
        if (targetLeafIds.length !== state.targetLeafIds.length) changed = true;
        next[tabId] =
          targetLeafIds.length === state.targetLeafIds.length
            ? state
            : { ...state, targetLeafIds };
      }

      return changed ? next : current;
    });
  }, [terminalLeaves, terminals]);

  useEffect(() => {
    const registeredLeaves = terminalLeaves.flatMap(({ tab, leafIds: ids }) => {
      const state = broadcastByTab[tab.id] ?? defaultState(tab);
      registerBroadcastTab(tab.id, ids, state.enabled, state.targetLeafIds);
      return ids;
    });
    return () => unregisterBroadcastLeaves(registeredLeaves);
  }, [broadcastByTab, terminalLeaves]);

  const stateForTab = useCallback(
    (tab: TerminalTab | null): TerminalBroadcastState =>
      tab ? broadcastByTab[tab.id] ?? defaultState(tab) : { enabled: false, targetLeafIds: [] },
    [broadcastByTab],
  );

  const toggleBroadcast = useCallback((tab: TerminalTab) => {
    setBroadcastByTab((current) => {
      const state = current[tab.id] ?? defaultState(tab);
      return {
        ...current,
        [tab.id]: { ...state, enabled: !state.enabled },
      };
    });
  }, []);

  const toggleBroadcastTarget = useCallback((tab: TerminalTab, leafId: number) => {
    setBroadcastByTab((current) => {
      const state = current[tab.id] ?? defaultState(tab);
      const selected = new Set(state.targetLeafIds);
      if (selected.has(leafId)) selected.delete(leafId);
      else selected.add(leafId);
      return {
        ...current,
        [tab.id]: { ...state, targetLeafIds: [...selected] },
      };
    });
  }, []);

  return { stateForTab, toggleBroadcast, toggleBroadcastTarget };
}
