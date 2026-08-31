import { cn } from "@/lib/utils";
import type { ArchitectureNode, ResizeHandle } from "../lib/architectureCanvasTypes";
import type { PointerEvent as ReactPointerEvent } from "react";

export function SelectionHandles({
  node,
  onResizePointerDown,
  onRotatePointerDown,
}: {
  node: ArchitectureNode;
  onResizePointerDown: (
    event: ReactPointerEvent<SVGRectElement>,
    node: ArchitectureNode,
    handle: ResizeHandle,
  ) => void;
  onRotatePointerDown: (
    event: ReactPointerEvent<SVGCircleElement>,
    node: ArchitectureNode,
  ) => void;
}) {
  const handleSize = 10;
  const centerX = node.width / 2;
  const handles: Array<{
    handle: ResizeHandle;
    x: number;
    y: number;
    cursor: string;
  }> = [
    { handle: "nw", x: 0, y: 0, cursor: "cursor-nw-resize" },
    { handle: "ne", x: node.width, y: 0, cursor: "cursor-ne-resize" },
    { handle: "se", x: node.width, y: node.height, cursor: "cursor-se-resize" },
    { handle: "sw", x: 0, y: node.height, cursor: "cursor-sw-resize" },
  ];

  return (
    <g className="pointer-events-auto text-primary">
      <rect
        width={node.width}
        height={node.height}
        fill="none"
        className="stroke-primary"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={centerX}
        y1="0"
        x2={centerX}
        y2="-28"
        className="stroke-primary"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={centerX}
        cy="-38"
        r="7"
        data-rotate-handle="true"
        className="cursor-grab fill-background stroke-primary active:cursor-grabbing"
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
        onPointerDown={(event) => onRotatePointerDown(event, node)}
      />
      {handles.map((item) => (
        <rect
          key={item.handle}
          x={item.x - handleSize / 2}
          y={item.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          rx="2.5"
          data-resize-handle={item.handle}
          className={cn("fill-background stroke-primary", item.cursor)}
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
          onPointerDown={(event) =>
            onResizePointerDown(event, node, item.handle)
          }
        />
      ))}
    </g>
  );
}
