import { useEffect, type RefObject } from "react";
import type { CanvasTerminalHandle } from "../CanvasTerminalNode";
import type { ArchitectureNode } from "./architectureCanvasTypes";
import type { TerminalDockStackLayout } from "../terminalDockLayout";
import {
  isCanvasNavBlockedTarget,
} from "./architectureCanvasModel";
import { navigateTerminalFocus } from "./canvasTerminalFocusModel";

export function useCanvasTerminalNavigation({
  active,
  activeTerminalId,
  liveSurfaceNodes,
  terminalNodes,
  selectedNodeId,
  maximizedTerminalGroupId,
  maximizedTerminalId,
  terminalLayoutById,
  terminalHandleRef,
  centerViewOnPlacement,
  setActiveTerminalId,
  setMaximizedTerminalId,
  setSelectedTerminal,
  setView,
}: {
  active: boolean;
  activeTerminalId: string;
  liveSurfaceNodes: ArchitectureNode[];
  terminalNodes: ArchitectureNode[];
  selectedNodeId: string;
  maximizedTerminalGroupId: string;
  maximizedTerminalId: string;
  terminalLayoutById: ReadonlyMap<string, TerminalDockStackLayout>;
  terminalHandleRef: RefObject<Map<string, CanvasTerminalHandle>>;
  centerViewOnPlacement: (
    view: { x: number; y: number; scale: number },
    node: ArchitectureNode,
  ) => { x: number; y: number; scale: number };
  setActiveTerminalId: (id: string) => void;
  setMaximizedTerminalId: (id: string) => void;
  setSelectedTerminal: (id: string) => void;
  setView: (
    update: (
      current: { x: number; y: number; scale: number },
    ) => { x: number; y: number; scale: number },
  ) => void;
}) {
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        !(event.metaKey || event.ctrlKey) ||
        isCanvasNavBlockedTarget(event.target)
      ) {
        return;
      }
      if (event.code === "Period") {
        event.preventDefault();
        const current =
          liveSurfaceNodes.find((node) => node.id === selectedNodeId) ??
          terminalNodes.find((node) => node.id === activeTerminalId);
        if (!current) return;
        const currentGroupId = terminalLayoutById.get(current.id)?.groupId;
        setMaximizedTerminalId(
          maximizedTerminalGroupId &&
            currentGroupId === maximizedTerminalGroupId
            ? ""
            : current.id,
        );
        return;
      }
      if (event.altKey || event.shiftKey) return;
      const direction: "left" | "right" | "up" | "down" | null =
        event.key === "ArrowLeft"
          ? "left"
          : event.key === "ArrowRight"
            ? "right"
            : event.key === "ArrowUp"
              ? "up"
              : event.key === "ArrowDown"
                ? "down"
                : null;
      if (!direction) return;

      event.preventDefault();
      const current = terminalNodes.find(
        (node) => node.id === activeTerminalId,
      );
      if (!current) return;
      if (maximizedTerminalId) setMaximizedTerminalId("");
      const best = navigateTerminalFocus(
        current.id,
        terminalNodes,
        direction,
        terminalHandleRef.current ?? undefined,
      );
      if (!best) return;
      setActiveTerminalId(best.id);
      setSelectedTerminal(best.id);
      setView((currentView) => centerViewOnPlacement(currentView, best));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    active,
    activeTerminalId,
    centerViewOnPlacement,
    liveSurfaceNodes,
    maximizedTerminalGroupId,
    maximizedTerminalId,
    selectedNodeId,
    setActiveTerminalId,
    setMaximizedTerminalId,
    setSelectedTerminal,
    setView,
    terminalHandleRef,
    terminalLayoutById,
    terminalNodes,
  ]);
}
