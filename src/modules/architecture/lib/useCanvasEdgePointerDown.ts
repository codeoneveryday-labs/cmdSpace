import type { PointerEvent as ReactPointerEvent } from "react";
import type { CanvasMode } from "./architectureCanvasTypes";

export function useCanvasEdgePointerDown({
  mode,
  onErase,
  selectEdge,
  setConnectSourceId,
}: {
  mode: CanvasMode;
  onErase: (id: string) => void;
  selectEdge: (id: string) => void;
  setConnectSourceId: (id: string | null) => void;
}) {
  return (event: ReactPointerEvent<SVGGElement>, edgeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (mode === "eraser") {
      onErase(edgeId);
      return;
    }
    selectEdge(edgeId);
    setConnectSourceId(null);
  };
}
