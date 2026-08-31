import type {
  RefObject,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { DiagramEdge } from "./DiagramEdge";
import { DiagramNode } from "./DiagramNode";
import {
  resolveConnectorNode,
} from "../lib/canvasGeometry";
import type {
  ArchitectureEdge,
  ArchitectureNode,
  CanvasMode,
  ConnectorHandle,
  ResizeHandle,
  ShapeConfig,
} from "../lib/architectureCanvasTypes";
import { cn } from "@/lib/utils";

export function CanvasDiagramSvg({
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
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onPointerDown,
  onDoubleClick,
  onWheel,
  onEdgePointerDown,
  onNodePointerDown,
  onNodeDoubleClick,
  onTextChange,
  onTextEditEnd,
  onResizePointerDown,
  onRotatePointerDown,
  onConnectorPointerDown,
  getShape,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  view: { x: number; y: number; scale: number };
  viewWidth: number;
  viewHeight: number;
  tabId: number;
  mode: CanvasMode;
  isShapeDrawingMode: (mode: CanvasMode) => boolean;
  canvasBackgroundImageId: string | null;
  markerId: string;
  frameDotsId: string;
  edges: ArchitectureEdge[];
  nodes: ArchitectureNode[];
  nodeById: Map<string, ArchitectureNode>;
  selectedEdgeId: string;
  selectedNodeIds: string[];
  editingTextId: string;
  connectSourceId: string | null;
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerLeave: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onDoubleClick: (event: ReactMouseEvent<SVGSVGElement>) => void;
  onWheel: (event: ReactWheelEvent<SVGSVGElement>) => void;
  onEdgePointerDown: (event: ReactPointerEvent<SVGGElement>, id: string) => void;
  onNodePointerDown: (event: ReactPointerEvent<SVGGElement>, node: ArchitectureNode) => void;
  onNodeDoubleClick: (event: ReactMouseEvent<SVGGElement>, node: ArchitectureNode) => void;
  onTextChange: (id: string, label: string) => void;
  onTextEditEnd: () => void;
  onResizePointerDown: (
    event: ReactPointerEvent<SVGRectElement>,
    node: ArchitectureNode,
    handle: ResizeHandle,
  ) => void;
  onRotatePointerDown: (
    event: ReactPointerEvent<SVGCircleElement>,
    node: ArchitectureNode,
  ) => void;
  onConnectorPointerDown: (
    event: ReactPointerEvent<SVGCircleElement>,
    node: ArchitectureNode,
    handle: ConnectorHandle,
  ) => void;
  getShape: (kind: ArchitectureNode["kind"]) => ShapeConfig;
}) {
  return (
          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`${view.x} ${view.y} ${viewWidth} ${viewHeight}`}
            preserveAspectRatio="none"
            className={cn(
              "relative z-10 block h-full w-full",
              mode === "pan" && "cursor-grab active:cursor-grabbing",
              mode === "eraser" && "cursor-cell",
              isShapeDrawingMode(mode) && "cursor-crosshair",
            )}
            role="img"
            aria-label="Architecture diagram canvas"
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerLeave={onPointerLeave}
                  onPointerDown={onPointerDown}
                  onDoubleClick={onDoubleClick}
            onWheel={onWheel}
          >
            <defs>
              <pattern
                id={`architecture-grid-${tabId}`}
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  className="stroke-[#dbe7e4] dark:stroke-zinc-800"
                  strokeOpacity="0.72"
                  strokeWidth="1"
                />
              </pattern>
              <pattern
                id={frameDotsId}
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="4" cy="4" r="1.8" fill="currentColor" opacity="0.22" />
              </pattern>
              <marker
                id={markerId}
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            <rect
              x={view.x}
              y={view.y}
              width={viewWidth}
              height={viewHeight}
              fill={
                canvasBackgroundImageId
                  ? "transparent"
                  : `url(#architecture-grid-${tabId})`
              }
            />

            {edges.map((item) => {
              const from = nodeById.get(item.from);
              const to = nodeById.get(item.to);
              if (!from || !to) return null;
              return (
                <DiagramEdge
                  key={item.id}
                  edge={item}
                  from={from}
                  to={to}
                  markerId={markerId}
                  selected={item.id === selectedEdgeId}
                  onPointerDown={onEdgePointerDown}
                />
              );
            })}

            {nodes.map((item) => {
              const displayNode = resolveConnectorNode(item, nodes);
              return (
                <DiagramNode
                  key={item.id}
                  markerId={markerId}
                  node={displayNode}
                  shape={getShape(item.kind)}
                  frameDotsId={frameDotsId}
                  selected={selectedNodeIds.includes(item.id)}
                  editing={item.id === editingTextId}
                  pendingConnect={item.id === connectSourceId}
                  onPointerDown={(event) => onNodePointerDown(event, item)}
                  onDoubleClick={(event) => onNodeDoubleClick(event, item)}
                  onTextChange={(label) => onTextChange(item.id, label)}
                  onTextEditEnd={onTextEditEnd}
                  onResizePointerDown={onResizePointerDown}
                  onRotatePointerDown={onRotatePointerDown}
                  onConnectorPointerDown={(event, _node, handle) =>
                    onConnectorPointerDown(event, item, handle)
                  }
                />
              );
            })}
          </svg>
  );
}
