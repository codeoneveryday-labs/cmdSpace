import { cn } from "@/lib/utils";
import type {
  ArchitectureNode,
  ConnectorHandle,
  Point,
} from "../lib/architectureCanvasTypes";
import type { PointerEvent as ReactPointerEvent } from "react";

export function ConnectorHandles({
  control,
  end,
  node,
  onConnectorPointerDown,
}: {
  control: Point;
  end: Point;
  node: ArchitectureNode;
  onConnectorPointerDown: (
    event: ReactPointerEvent<SVGCircleElement>,
    node: ArchitectureNode,
    handle: ConnectorHandle,
  ) => void;
}) {
  const handles: Array<{
    handle: ConnectorHandle;
    point: Point;
    cursor: string;
  }> = [
    { handle: "start", point: { x: 0, y: 0 }, cursor: "cursor-move" },
    {
      handle: "control",
      point: control,
      cursor: "cursor-grab active:cursor-grabbing",
    },
    { handle: "end", point: end, cursor: "cursor-move" },
  ];

  return (
    <g className="pointer-events-auto text-primary">
      <line
        x1="0"
        y1="0"
        x2={control.x}
        y2={control.y}
        className="stroke-primary/45"
        strokeDasharray="4 4"
        strokeWidth="1.3"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={control.x}
        y1={control.y}
        x2={end.x}
        y2={end.y}
        className="stroke-primary/45"
        strokeDasharray="4 4"
        strokeWidth="1.3"
        vectorEffect="non-scaling-stroke"
      />
      {handles.map((item) => (
        <circle
          key={item.handle}
          cx={item.point.x}
          cy={item.point.y}
          r={item.handle === "control" ? 6.5 : 5.5}
          data-connector-handle={item.handle}
          className={cn("fill-background stroke-primary", item.cursor)}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          onPointerDown={(event) =>
            onConnectorPointerDown(event, node, item.handle)
          }
        />
      ))}
    </g>
  );
}
