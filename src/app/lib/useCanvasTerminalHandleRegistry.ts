import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { CanvasTerminalHandle } from "@/modules/architecture/CanvasTerminalNode";

export function useCanvasTerminalHandleRegistry({
  canvasTerminalRefs,
  activeCanvasTerminalIds,
  setSelectionVersion,
  refKey,
}: {
  canvasTerminalRefs: MutableRefObject<Map<string, CanvasTerminalHandle>>;
  activeCanvasTerminalIds: MutableRefObject<Map<number, string>>;
  setSelectionVersion: Dispatch<SetStateAction<number>>;
  refKey: (tabId: number, terminalId: string) => string;
}) {
  const onCanvasTerminalHandleChange = useCallback(
    (tabId: number, terminalId: string, handle: CanvasTerminalHandle | null) => {
      const key = refKey(tabId, terminalId);
      if (handle) canvasTerminalRefs.current.set(key, handle);
      else canvasTerminalRefs.current.delete(key);
    },
    [canvasTerminalRefs, refKey],
  );

  const onActiveCanvasTerminalChange = useCallback(
    (tabId: number, terminalId: string | null) => {
      if (terminalId) activeCanvasTerminalIds.current.set(tabId, terminalId);
      else activeCanvasTerminalIds.current.delete(tabId);
      setSelectionVersion((version) => version + 1);
    },
    [activeCanvasTerminalIds, setSelectionVersion],
  );

  return { onCanvasTerminalHandleChange, onActiveCanvasTerminalChange };
}
