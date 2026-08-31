import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import { useCanvasHistory } from "./useCanvasHistory";
import type {
  ArchitectureEdge,
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  CanvasMode,
  DragState,
  HistorySnapshot,
} from "./architectureCanvasTypes";
import { cloneNodes, MAX_HISTORY } from "./architectureCanvasModel";

export function useCanvasDiagramHistory({
  nodes,
  edges,
  terminalDockGroups,
  nextNodeRef,
  nextEdgeRef,
  setNodes,
  setEdges,
  setTerminalDockGroups,
  clearSelection,
  setConnectSourceId,
  setMode,
  setDrag,
  setEditingTextId,
}: {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  nextNodeRef: MutableRefObject<number>;
  nextEdgeRef: MutableRefObject<number>;
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  setEdges: Dispatch<SetStateAction<ArchitectureEdge[]>>;
  setTerminalDockGroups: Dispatch<SetStateAction<ArchitectureTerminalDockGroup[]>>;
  clearSelection: () => void;
  setConnectSourceId: (id: string | null) => void;
  setMode: Dispatch<SetStateAction<CanvasMode>>;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
  setEditingTextId: Dispatch<SetStateAction<string>>;
}) {
  return useCanvasHistory<HistorySnapshot>({
    capture: () => ({
      nodes: cloneNodes(nodes),
      edges: edges.map((item) => ({ ...item })),
      terminalDockGroups: structuredClone(terminalDockGroups),
      nextNode: nextNodeRef.current,
      nextEdge: nextEdgeRef.current,
    }),
    restore: (snapshot) => {
      setNodes(cloneNodes(snapshot.nodes));
      setEdges(snapshot.edges.map((item) => ({ ...item })));
      setTerminalDockGroups(structuredClone(snapshot.terminalDockGroups));
      nextNodeRef.current = snapshot.nextNode;
      nextEdgeRef.current = snapshot.nextEdge;
      clearSelection();
      setConnectSourceId(null);
      setMode("select");
      setDrag(null);
      setEditingTextId("");
    },
    maxHistory: MAX_HISTORY,
  });
}
