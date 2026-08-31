import type { ArchitectureNode } from "./architectureCanvasTypes";
import type { CanvasTerminalHandle } from "../CanvasTerminalNode";
import { findNearestTerminalInDirection } from "./architectureTerminalNavigationModel";

export type TerminalHandleMap = Map<string, CanvasTerminalHandle>;

export function registerTerminalHandle(
  handles: TerminalHandleMap,
  terminalId: string,
  handle: CanvasTerminalHandle | null,
): void {
  if (handle) {
    handles.set(terminalId, handle);
  } else {
    handles.delete(terminalId);
  }
}

export function focusTerminalNodeHandle(
  handles: TerminalHandleMap,
  terminalId: string,
): boolean {
  const handle = handles.get(terminalId);
  if (handle?.focus) {
    handle.focus();
    return true;
  }
  return false;
}

export function navigateTerminalFocus(
  currentTerminalId: string,
  nodes: ArchitectureNode[],
  direction: "left" | "right" | "up" | "down",
  handles?: TerminalHandleMap,
): ArchitectureNode | null {
  const currentNode = nodes.find((n) => n.id === currentTerminalId);
  if (!currentNode) return null;

  const terminalNodes = nodes.filter(
    (n) => n.kind === "terminal" && n.id !== currentTerminalId,
  );
  const nextNode = findNearestTerminalInDirection(
    currentNode,
    terminalNodes,
    direction,
  );
  if (nextNode && handles) {
    focusTerminalNodeHandle(handles, nextNode.id);
  }
  return nextNode;
}
