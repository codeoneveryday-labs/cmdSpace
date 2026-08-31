import type { ArchitectureTerminalDockGroup } from "@/modules/tabs";
import { useEffect, useState } from "react";
import {
  activateTerminalTab as updateActiveTerminalTab,
  type TerminalDockStackLayout,
} from "../terminalDockLayout";
import { resolveNextTerminalTabState } from "./canvasTerminalInteractionModel";

export function useCanvasTerminalTabState({
  onActiveTerminalChange,
  selectSingleNode,
  setMaximizedTerminalId,
  setTerminalDockGroups,
  tabId,
}: {
  onActiveTerminalChange?: (
    tabId: number,
    terminalId: string | null,
  ) => void;
  selectSingleNode: (id: string) => void;
  setMaximizedTerminalId: React.Dispatch<React.SetStateAction<string>>;
  setTerminalDockGroups: React.Dispatch<
    React.SetStateAction<ArchitectureTerminalDockGroup[]>
  >;
  tabId: number;
}) {
  const [activeTerminalId, setActiveTerminalId] = useState("");

  useEffect(() => {
    onActiveTerminalChange?.(tabId, activeTerminalId || null);
  }, [activeTerminalId, onActiveTerminalChange, tabId]);

  useEffect(
    () => () => onActiveTerminalChange?.(tabId, null),
    [onActiveTerminalChange, tabId],
  );

  const activateTerminal = (terminalId: string) => {
    setActiveTerminalId(terminalId);
    selectSingleNode(terminalId);
  };

  const activateTerminalTab = ({
    layout,
    maximized,
    terminalId,
  }: {
    layout?: Pick<TerminalDockStackLayout, "stackId">;
    maximized: boolean;
    terminalId: string;
  }) => {
    activateTerminal(terminalId);
    if (maximized) setMaximizedTerminalId(terminalId);
    if (!layout) return;
    setTerminalDockGroups((current) =>
      updateActiveTerminalTab(current, layout.stackId, terminalId),
    );
  };

  const closeTerminalTab = ({
    layout,
    maximizedTerminalId,
    terminalId,
  }: {
    layout?: Pick<TerminalDockStackLayout, "terminalIds">;
    maximizedTerminalId: string;
    terminalId: string;
  }) => {
    const nextState = resolveNextTerminalTabState({
      activeTerminalId,
      closingTerminalId: terminalId,
      maximizedTerminalId,
      terminalIds: layout?.terminalIds ?? [],
    });
    if (nextState.activeTerminalId !== activeTerminalId) {
      setActiveTerminalId(nextState.activeTerminalId);
    }
    if (nextState.maximizedTerminalId !== maximizedTerminalId) {
      setMaximizedTerminalId(nextState.maximizedTerminalId);
    }
  };

  return {
    activateTerminal,
    activateTerminalTab,
    activeTerminalId,
    closeTerminalTab,
    setActiveTerminalId,
  };
}
