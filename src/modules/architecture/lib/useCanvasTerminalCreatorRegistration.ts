import { useEffect, type MutableRefObject } from "react";
import { MAX_PANES_PER_TAB } from "@/modules/tabs";
import type { ArchitectureNode } from "./architectureCanvasTypes";

export function useCanvasTerminalCreatorRegistration({
  tabId,
  nodes,
  pendingTerminalCommandRef,
  beginSurfacePlacement,
  onRegisterTerminalCreator,
}: {
  tabId: number;
  nodes: readonly ArchitectureNode[];
  pendingTerminalCommandRef: MutableRefObject<string | undefined>;
  beginSurfacePlacement: (kind: "terminal") => void;
  onRegisterTerminalCreator?: (
    tabId: number,
    creator: ((initialCommand?: string) => boolean) | null,
  ) => void;
}): void {
  useEffect(() => {
    onRegisterTerminalCreator?.(tabId, (initialCommand) => {
      const terminalCount = nodes.filter((node) => node.kind === "terminal").length;
      if (terminalCount >= MAX_PANES_PER_TAB) return false;
      pendingTerminalCommandRef.current = initialCommand;
      beginSurfacePlacement("terminal");
      return true;
    });
    return () => onRegisterTerminalCreator?.(tabId, null);
  }, [
    beginSurfacePlacement,
    nodes,
    onRegisterTerminalCreator,
    pendingTerminalCommandRef,
    tabId,
  ]);
}
