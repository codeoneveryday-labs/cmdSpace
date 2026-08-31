import { usePreferencesStore } from "@/modules/settings/preferences";
import type { CanvasTerminalHandle } from "./CanvasTerminalNode";
import { CanvasViewport } from "./components/CanvasViewport";
import { CanvasToolbar } from "./components/CanvasToolbar";
import type {
  ArchitectureCanvasProps,
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  CanvasMode,
  ConnectorHandle,
  DragState,
  Point,
  ResizeHandle,
  ShapeKind,
  TerminalDropPreview,
} from "./lib/architectureCanvasTypes";
import {
  createCanvasNode,
} from "./lib/architectureDiagramSeed";
import { shapeFor } from "./lib/architectureShapeCatalog";
import { useCanvasCamera } from "./lib/useCanvasCamera";
import { useCanvasDocking } from "./lib/useCanvasDocking";
import { useCanvasDiagramHistory } from "./lib/useCanvasDiagramHistory";
import { useCanvasDiagramPersistence } from "./lib/useCanvasDiagramPersistence";
import { useCanvasNodeActions } from "./lib/useCanvasNodeActions";
import { useCanvasNodePointerDown } from "./lib/useCanvasNodePointerDown";
import { useCanvasTerminalGroupPointerDown } from "./lib/useCanvasTerminalGroupPointerDown";
import { useCanvasPointerMove } from "./lib/useCanvasPointerMove";
import { useCanvasPointerEnd } from "./lib/useCanvasPointerEnd";
import { useCanvasSurfacePlacementActions } from "./lib/useCanvasSurfacePlacementActions";
import { useCanvasTerminalLayerActions } from "./lib/useCanvasTerminalLayerActions";
import { useCanvasTerminalSizeMigration } from "./lib/useCanvasTerminalSizeMigration";
import { useCanvasTerminalViewModel } from "./lib/useCanvasTerminalViewModel";
import { useCanvasBrowserLayerActions } from "./lib/useCanvasBrowserLayerActions";
import { useCanvasDockDividerPointerDown } from "./lib/useCanvasDockDividerPointerDown";
import { useCanvasEdgePointerDown } from "./lib/useCanvasEdgePointerDown";
import { useCanvasDeleteShortcut } from "./lib/useCanvasDeleteShortcut";
import { useCanvasUndoShortcut } from "./lib/useCanvasUndoShortcut";
import { useCanvasSurfaceDockTarget } from "./lib/useCanvasSurfaceDockTarget";
import { useCanvasTextEditing } from "./lib/useCanvasTextEditing";
import { useCanvasPointerDown } from "./lib/useCanvasPointerDown";
import { useCanvasSelection } from "./lib/useCanvasSelection";
import { useCanvasToolShortcuts } from "./lib/useCanvasToolShortcuts";
import { useCanvasShapeGestures } from "./lib/useCanvasShapeGestures";
import { useCanvasTerminalNavigation } from "./lib/useCanvasTerminalNavigation";
import { useCanvasTerminalCreatorRegistration } from "./lib/useCanvasTerminalCreatorRegistration";
import { useCanvasDiagramState } from "./lib/useCanvasDiagramState";
import { useCanvasPlacement } from "./lib/useCanvasPlacement";
import { isShapeDrawingMode } from "./lib/architectureCanvasModel";
export { findNearestTerminalInDirection } from "./lib/architectureCanvasModel";
import {
  commitTerminalGroupClose,
} from "./lib/useCanvasTerminalInteractions";
import { useCanvasTerminalTabState } from "./lib/useCanvasTerminalTabState";
import { useCanvasDiagramViewModel } from "./lib/useCanvasDiagramViewModel";
import {
  terminalDockGroupUsesSharedHeader,
  updateTerminalGroupBounds,
  type TerminalDockDividerLayout,
} from "./terminalDockLayout";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

export function ArchitectureCanvas({
  active,
  tabId,
  seed,
  onDiagramChange,
  onTerminalHandleChange,
  onActiveTerminalChange,
  onRegisterTerminalCreator,
  canvasFocused = false,
  onToggleCanvasFocus,
}: ArchitectureCanvasProps) {
  const appZoom = usePreferencesStore((state) => state.zoomLevel);
  const canvasBackgroundImageId = usePreferencesStore(
    (state) => state.canvasBackgroundImageId,
  );
  const svgRef = useRef<SVGSVGElement | null>(null);
  const {
    nodes,
    setNodes,
    edges,
    setEdges,
    terminalDockGroups,
    setTerminalDockGroups,
    nextNodeRef,
    nextEdgeRef,
  } = useCanvasDiagramState(seed);
  const {
    clearEdgeSelection,
    clearSelection,
    selectEdge,
    selectSingleNode,
    selectedEdgeId,
    selectedNodeId,
    selectedNodeIds,
    toggleNodeSelection,
  } = useCanvasSelection();
  const [mode, setMode] = useState<CanvasMode>("select");
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [terminalDropPreview, setTerminalDropPreview] =
    useState<TerminalDropPreview | null>(null);
  const terminalWorldRef = useRef<HTMLDivElement | null>(null);
  const camera = useCanvasCamera({ appZoom, svgRef, terminalWorldRef });
  const {
    centerViewOnPlacement,
    drawableBounds,
    pan,
    setView,
    terminalTransform,
    view,
    viewHeight,
    viewWidth,
    zoomBy,
  } = camera;
  const placement = useCanvasPlacement();
  const {
    placements: terminalPlacements,
    isFreePlacement: isFreeTerminalPlacement,
    pendingSurfaceKind,
    beginPlacement,
    resetPlacement,
    toggleFreePlacement,
  } = placement;
  const pendingTerminalCommandRef = useRef<string | undefined>(undefined);
  const [maximizedTerminalId, setMaximizedTerminalId] = useState("");
  // terminalId -> handle, populated via onTerminalHandleChange so Cmd+Arrow
  // can move real input focus to the newly active terminal node.
  const terminalHandleRef = useRef(new Map<string, CanvasTerminalHandle>());
  const resetEditingTextRef = useRef<Dispatch<SetStateAction<string>>>(
    () => undefined,
  );

  const markerId = `architecture-arrow-${tabId}`;
  const frameDotsId = `architecture-frame-dots-${tabId}`;
  const {
    selectedNode,
    selectedEdge,
    selectedLocked,
    nodeById,
    liveSurfaceNodes,
    terminalNodes,
    interactiveSurfaceNodes,
  } = useCanvasDiagramViewModel({
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
  });
  const {
    terminalLayouts,
    terminalLayoutById,
    maximizedTerminalGroupId,
    renderedTerminalDockGroups,
    renderedTerminalLayouts,
    renderedTerminalLayoutById,
    renderedTerminalDockDividers,
  } = useCanvasTerminalViewModel({
    terminalDockGroups,
    maximizedTerminalId,
    view,
    viewWidth,
    viewHeight,
  });
  useCanvasTerminalSizeMigration(setNodes);

  useCanvasDiagramPersistence({
    tabId,
    nodes,
    edges,
    terminalDockGroups,
    onDiagramChange,
  });

  const terminalInteractions = useCanvasTerminalTabState({
    onActiveTerminalChange,
    selectSingleNode,
    setMaximizedTerminalId,
    setTerminalDockGroups,
    tabId,
  });
  const { activeTerminalId, setActiveTerminalId } = terminalInteractions;

  const { canUndo, historySize, pushHistory, undoCanvas: undoHistory } =
    useCanvasDiagramHistory({
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
      setEditingTextId: resetEditingTextRef.current,
    });

  const shapeGestures = useCanvasShapeGestures({
    terminalDockGroups,
    terminalLayoutById,
    svgRef,
    svgPointFromClient: camera.svgPointFromClient,
    setNodes,
    setTerminalDockGroups,
    setDrag,
    setConnectSourceId,
    pushHistory,
    selectSingleNode,
    updateTerminalGroupBounds,
  });
  const undoCanvas = () => {
    undoHistory();
    shapeGestures.clear();
  };
  const { drawing, resize } = shapeGestures;

  const docking = useCanvasDocking({
    nodes,
    terminalNodes: liveSurfaceNodes,
    terminalDockGroups,
    terminalLayouts,
    resizeTerminalGroupId: resize?.terminalGroupId,
    view,
    viewWidth,
    viewHeight,
    svgRef,
    svgPointFromClient: camera.svgPointFromClient,
    setTerminalDockGroups,
  });
  const {
    terminalDockDropTarget,
    terminalDockIndicator,
    terminalPlacementObstacles,
    terminalResizePaused,
  } = docking;

  useCanvasUndoShortcut({ active, canUndo, undoCanvas });

  useCanvasTerminalNavigation({
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
    setSelectedTerminal: selectSingleNode,
    setView,
  });

  const {
    connectNodes,
    eraseEdge,
    eraseNode,
    removeSelectedEdge,
    removeSelectedNode,
    toggleSelectedLock,
  } = useCanvasNodeActions({
    nodes,
    edges,
    selectedNode,
    selectedEdge,
    selectedNodeIds,
    connectSourceId,
    nextEdgeRef,
    setNodes,
    setEdges,
    setTerminalDockGroups,
    setConnectSourceId,
    setMode,
    pushHistory,
    clearSelection,
    clearEdgeSelection,
    selectSingleNode,
    selectEdge,
  });

  useCanvasDeleteShortcut({
    active,
    selectedNodeIds,
    selectedNode,
    selectedEdge,
    removeSelectedNode,
    removeSelectedEdge,
  });

  const closeTerminalGroup = (group: ArchitectureTerminalDockGroup) =>
    commitTerminalGroupClose({
      group,
      activeTerminalId,
      maximizedTerminalId,
      pushHistory,
      setNodes,
      setEdges,
      setTerminalDockGroups,
      setActiveTerminalId,
      setMaximizedTerminalId,
      clearSelection,
      setConnectSourceId,
    });

  const handleNodePointerDown = useCanvasNodePointerDown({
    mode,
    selectedNodeIds,
    svgRef,
    terminalLayoutById,
    svgPointFromClient: camera.svgPointFromClient,
    onErase: eraseNode,
    onConnect: connectNodes,
    startPan: camera.startPan,
    toggleNodeSelection,
    selectSingleNode,
    pushHistory,
    clearTerminalDockDropTarget: docking.clearTerminalDockDropTarget,
    setTerminalDropPreview,
    setDrag,
  });

  const handleTerminalGroupHeaderPointerDown =
    useCanvasTerminalGroupPointerDown({
      mode,
      selectedNodeIds,
      svgRef,
      svgPointFromClient: camera.svgPointFromClient,
      onNodePointerDown: handleNodePointerDown,
      selectSingleNode,
      pushHistory,
      clearTerminalDockDropTarget: docking.clearTerminalDockDropTarget,
      setTerminalDropPreview,
      setDrag,
    });

  const handleResizePointerDown = (
    event: ReactPointerEvent<SVGRectElement>,
    item: ArchitectureNode,
    handle: ResizeHandle,
  ) => {
    shapeGestures.beginResize(event, item, handle);
  };

  const handleDockDividerPointerDown = useCanvasDockDividerPointerDown({
    pushHistory,
    setDrag,
    clearShapeGestures: shapeGestures.clear,
    beginDockDividerResize: docking.beginDockDividerResize,
    svgPointFromClient: camera.svgPointFromClient,
  });

  const handleDockDividerPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) => docking.handleDockDividerPointerMove(event, divider);

  const finishDockDividerResize = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => docking.finishDockDividerResize(event);

  const handleDockDividerKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) =>
    docking.handleDockDividerKeyDown(event, divider, () => {
      pushHistory();
    });

  const handleRotatePointerDown = (
    event: ReactPointerEvent<SVGCircleElement>,
    item: ArchitectureNode,
  ) => {
    shapeGestures.beginRotate(event, item);
  };

  const handleConnectorPointerDown = (
    event: ReactPointerEvent<SVGCircleElement>,
    item: ArchitectureNode,
    handle: ConnectorHandle,
  ) => {
    shapeGestures.beginConnector(event, item, handle);
  };

  const handleEdgePointerDown = useCanvasEdgePointerDown({
    mode,
    onErase: eraseEdge,
    selectEdge,
    setConnectSourceId,
  });

  const resolveLiveSurfaceDockTarget = useCanvasSurfaceDockTarget({
    svgRef,
    terminalLayouts,
    view,
    viewWidth,
    viewHeight,
    clearTarget: docking.clearTerminalDockDropTarget,
    resolveTarget: docking.resolveTerminalDockDropTargetAtPoint,
  });

  const handlePointerMove = useCanvasPointerMove({
    panActive: Boolean(pan),
    drag,
    nodes,
    selectedNodeIds,
    terminalDockGroups,
    terminalLayouts,
    panFromPointer: camera.panFromPointer,
    updateShapeGesture: shapeGestures.updatePointer,
    svgPointFromClient: camera.svgPointFromClient,
    drawableBounds,
    updateTerminalGroupBounds,
    resolveLiveSurfaceDockTarget,
    setTerminalDockGroups,
    setTerminalDropPreview,
    setNodes,
  });

  function createNode(
    kind: ShapeKind,
    point: Point,
    fromDrag = false,
  ): ArchitectureNode {
    return createCanvasNode({
      id: `n${nextNodeRef.current++}`,
      kind,
      point,
      bounds: drawableBounds(),
      fromDrag,
    });
  }

  const {
    beginSurfacePlacement,
    commitFreeSurfacePlacement,
    commitSurfacePlacement,
    createDockedSurface,
  } = useCanvasSurfacePlacementActions({
    liveSurfaceNodes,
    terminalNodes,
    activeTerminalId,
    selectedNode,
    maximizedTerminalId,
    terminalDockGroups,
    terminalPlacementObstacles,
    view,
    viewWidth,
    viewHeight,
    nextNodeRef,
    pendingTerminalCommandRef,
    createNode,
    pushHistory,
    clearSelection,
    setConnectSourceId,
    setMode,
    setNodes,
    setTerminalDockGroups,
    setActiveTerminalId,
    setMaximizedTerminalId,
    selectSingleNode,
    beginPlacement,
    resetPlacement,
  });

  useCanvasTerminalCreatorRegistration({
    tabId,
    nodes,
    pendingTerminalCommandRef,
    beginSurfacePlacement,
    onRegisterTerminalCreator,
  });

  useCanvasToolShortcuts({
    active,
    pendingSurfaceKind,
    selectedNodeId,
    terminalPlacements,
    onBeginSurfacePlacement: beginSurfacePlacement,
    onClearEdgeSelection: clearEdgeSelection,
    onCommitSurfacePlacement: commitSurfacePlacement,
    onSetConnectSourceId: setConnectSourceId,
    onToggleFreePlacement: toggleFreePlacement,
    onSetMode: setMode,
    onResetPlacement: resetPlacement,
  });

  const handleCanvasPointerDown = useCanvasPointerDown({
    mode,
    terminalPlacements,
    isFreeTerminalPlacement,
    pendingSurfaceKind,
    svgPointFromClient: camera.svgPointFromClient,
    startPan: camera.startPan,
    commitFreeSurfacePlacement,
    beginSurfacePlacement,
    pushHistory,
    createNode,
    setNodes,
    beginDrawing: shapeGestures.beginDrawing,
    selectSingleNode,
    setConnectSourceId,
    clearSelection,
    resetPlacement,
  });

  const {
    editingTextId,
    handleCanvasDoubleClick,
    handleNodeDoubleClick,
    setEditingTextId,
    updateTextNodeLabel,
  } = useCanvasTextEditing({
    setNodes,
    createTextNode: (point) => createNode("text", point),
    svgPointFromClient: camera.svgPointFromClient,
    pushHistory,
    selectSingleNode,
    setConnectSourceId,
    setMode,
  });
  resetEditingTextRef.current = setEditingTextId;

  const handlePointerEnd = useCanvasPointerEnd({
    drawing,
    drag,
    nodes,
    terminalDockGroups,
    terminalLayouts,
    terminalNodes,
    terminalDropPreview,
    selectedNodeIds,
    getTerminalDockDropTarget: docking.getTerminalDockDropTarget,
    setMode,
    setDrag,
    setTerminalDropPreview,
    clearTerminalDockDropTarget: docking.clearTerminalDockDropTarget,
    stopPan: camera.stopPan,
    clearShapeGestures: shapeGestures.clear,
    setNodes,
    setTerminalDockGroups,
    drawableBounds,
  });

  const terminalLayerActions = useCanvasTerminalLayerActions({
    tabId,
    nodeById,
    terminalInteractions,
    terminalHandleRef: terminalHandleRef.current,
    onTerminalHandleChange,
    handleTerminalGroupHeaderPointerDown,
    handleNodePointerDown,
    handlePointerMove,
    handlePointerEnd,
    camera,
    closeTerminalGroup,
    eraseNode,
    createDockedSurface,
    pushHistory,
    setNodes,
    setMaximizedTerminalId,
    terminalDockGroupUsesSharedHeader,
    handleResizePointerDown,
    handleDockDividerPointerDown,
    handleDockDividerPointerMove,
    finishDockDividerResize,
    handleDockDividerKeyDown,
  });

  const browserLayerActions = useCanvasBrowserLayerActions({
    nodeById,
    terminalInteractions,
    selectSingleNode,
    setActiveTerminalId,
    setMaximizedTerminalId,
    setNodes,
    pushHistory,
    handleNodePointerDown,
    handleTerminalGroupHeaderPointerDown,
    terminalDockGroupUsesSharedHeader,
    closeTerminalGroup,
    eraseNode,
    createDockedSurface,
    handleResizePointerDown,
  });

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background text-foreground">
      <CanvasToolbar
        mode={mode}
        pendingSurfaceKind={pendingSurfaceKind}
        selectedLocked={selectedLocked}
        hasSelection={Boolean(selectedNode || selectedEdge)}
        historySize={historySize}
        zoom={view.scale}
        onModeChange={(nextMode) => {
          setMode(nextMode);
          setConnectSourceId(nextMode === "connect" ? selectedNodeId || null : null);
          if (nextMode === "connect") clearEdgeSelection();
        }}
        onBeginSurfacePlacement={beginSurfacePlacement}
        onToggleSelectedLock={toggleSelectedLock}
        onUndo={undoCanvas}
        onZoomBy={zoomBy}
      />

      <CanvasViewport
        backgroundImageId={canvasBackgroundImageId}
        diagram={{
          svgRef,
          view,
          viewWidth,
          viewHeight,
          tabId,
          mode,
          isShapeDrawingMode,
          canvasBackgroundImageId,
          markerId,
          frameDotsId,
          edges,
          nodes,
          nodeById,
          selectedEdgeId,
          selectedNodeIds,
          editingTextId,
          connectSourceId,
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerEnd,
          onPointerLeave: handlePointerEnd,
          onPointerDown: handleCanvasPointerDown,
          onDoubleClick: handleCanvasDoubleClick,
          onWheel: camera.handleWheel,
          onEdgePointerDown: handleEdgePointerDown,
          onNodePointerDown: handleNodePointerDown,
          onNodeDoubleClick: handleNodeDoubleClick,
          onTextChange: updateTextNodeLabel,
          onTextEditEnd: () => setEditingTextId(""),
          onResizePointerDown: handleResizePointerDown,
          onRotatePointerDown: handleRotatePointerDown,
          onConnectorPointerDown: handleConnectorPointerDown,
          getShape: shapeFor,
        }}
        terminalLayer={{
          active,
          mode,
          terminalWorldRef,
          terminalTransform,
          terminalNodes,
          nodeById,
          terminalDockGroups,
          activeTerminalId,
          selectedNodeIds,
          terminalLayouts,
          renderedTerminalDockGroups,
          renderedTerminalLayouts,
          terminalLayoutById,
          renderedTerminalLayoutById,
          renderedTerminalDockDividers,
          maximizedTerminalId,
          maximizedTerminalGroupId,
          terminalResizePaused,
          actions: terminalLayerActions,
        }}
        browserLayer={{
          active,
          mode,
          panActive: Boolean(pan),
          dragActive: Boolean(drag),
          resizeActive: Boolean(resize),
          terminalResizePaused,
          appZoom,
          view,
          browserNodes: interactiveSurfaceNodes,
          nodeById,
          terminalDockGroups,
          terminalLayouts,
          terminalLayoutById,
          renderedTerminalLayoutById,
          maximizedTerminalId,
          maximizedTerminalGroupId,
          selectedNodeIds,
          actions: browserLayerActions,
        }}
        overlays={{
          terminalDropPreview,
          terminalDockDropTarget,
          terminalDockIndicator,
          view,
          viewWidth,
          viewHeight,
          terminalPlacements,
          pendingSurfaceKind,
          isFreeTerminalPlacement,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          zoom: view.scale,
          canvasFocused,
          onToggleCanvasFocus,
          onPlaceFreeSurface: (point) => {
            if (pendingSurfaceKind) {
              commitFreeSurfacePlacement(
                pendingSurfaceKind,
                camera.svgPointFromClient(point),
              );
            }
          },
          onPlaceSurface: (placement) => {
            if (pendingSurfaceKind) {
              commitSurfacePlacement(pendingSurfaceKind, placement);
            }
          },
        }}
      />
    </div>
  );
}
