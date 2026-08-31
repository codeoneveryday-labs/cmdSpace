import { cn } from "@/lib/utils";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  edgeAnchorPoint,
} from "../lib/canvasGeometry";
import type {
  ArchitectureEdge,
  ArchitectureNode,
} from "../lib/architectureCanvasTypes";

export function DiagramEdge({
  edge,
  from,
  to,
  markerId,
  selected,
  onPointerDown,
}: {
  edge: ArchitectureEdge;
  from: ArchitectureNode;
  to: ArchitectureNode;
  markerId: string;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>, id: string) => void;
}) {
  const start = edgeAnchorPoint(from, to, false);
  const end = edgeAnchorPoint(to, from, true);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const path = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;

  return (
    <g
      className={cn(
        "cursor-pointer",
        selected ? "text-primary" : "text-foreground/55",
        edge.locked && "text-muted-foreground/50",
      )}
      onPointerDown={(event) => onPointerDown(event, edge.id)}
    >
      <path d={path} fill="none" stroke="transparent" strokeWidth="14" />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeDasharray={edge.locked ? "6 5" : undefined}
        strokeWidth={selected ? 3 : 2}
        markerEnd={`url(#${markerId})`}
      />
      {edge.label ? (
        <g>
          <rect
            x={midX - Math.max(36, edge.label.length * 3.2)}
            y={midY - 19}
            width={Math.max(72, edge.label.length * 6.4)}
            height="18"
            rx="9"
            className="fill-background stroke-border"
          />
          <text
            x={midX}
            y={midY - 6}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            {edge.label}
          </text>
        </g>
      ) : null}
    </g>
  );
}
