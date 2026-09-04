import { cn } from "@/lib/utils";
import {
  connectorControlPoint,
  connectorPath,
  isConnectorKind,
  nodeTransform,
} from "../lib/canvasGeometry";
import type {
  ArchitectureNode,
  ConnectorHandle,
  Point,
  ResizeHandle,
  ShapeConfig,
} from "../lib/architectureCanvasTypes";
import { ImageAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
  ChangeEvent as ReactChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { ConnectorHandles } from "./ConnectorHandles";
import { NodeLockBadge } from "./NodeLockBadge";
import { SelectionHandles } from "./SelectionHandles";

function pointsToString(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function textNodeLines(value: string): string[] {
  return value.split("\n").slice(0, 12);
}

export function DiagramNode({
  node,
  shape,
  selected,
  editing,
  pendingConnect,
  markerId,
  frameDotsId,
  onPointerDown,
  onDoubleClick,
  onTextChange,
  onTextEditEnd,
  onResizePointerDown,
  onRotatePointerDown,
  onConnectorPointerDown,
}: {
  node: ArchitectureNode;
  shape: ShapeConfig;
  selected: boolean;
  editing: boolean;
  pendingConnect: boolean;
  markerId: string;
  frameDotsId: string;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
  onDoubleClick: (event: ReactMouseEvent<SVGGElement>) => void;
  onTextChange: (label: string) => void;
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
}) {
  const selectedClass = selected ? "stroke-primary" : "stroke-border";
  const nodeClassName = cn(
    node.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
    selected && "text-primary",
  );
  const transform = nodeTransform(node);

  if (isConnectorKind(node.kind)) {
    const path = connectorPath(node);
    const control = connectorControlPoint(node);
    return (
      <g
        transform={`translate(${node.x} ${node.y})`}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="16"
        />
        <path
          d={path}
          fill="none"
          className={cn(selected ? "stroke-primary" : "stroke-foreground/70")}
          strokeDasharray={node.locked ? "6 5" : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={selected ? 3 : 2}
          markerEnd={node.kind === "arrow" ? `url(#${markerId})` : undefined}
        />
        {selected && !node.locked ? (
          <ConnectorHandles
            control={control}
            end={{ x: node.width, y: node.height }}
            node={node}
            onConnectorPointerDown={onConnectorPointerDown}
          />
        ) : null}
        {node.locked ? <NodeLockBadge x={node.width} y={node.height} /> : null}
      </g>
    );
  }

  if (node.kind === "pen") {
    const points = pointsToString(node.points ?? [{ x: 0, y: 0 }]);
    return (
      <g
        transform={`translate(${node.x} ${node.y})`}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <polyline
          points={points}
          fill="none"
          stroke="transparent"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="16"
        />
        <polyline
          points={points}
          fill="none"
          className={cn(selected ? "stroke-primary" : "stroke-foreground/75")}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={node.locked ? "6 5" : undefined}
          strokeWidth={selected ? 3 : 2}
        />
        {node.locked ? <NodeLockBadge x={18} y={-18} /> : null}
      </g>
    );
  }

  if (node.kind === "rectangle") {
    return (
      <g
        transform={transform}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <rect
          width={node.width}
          height={node.height}
          rx="12"
          fill="none"
          className={cn(
            "stroke-foreground/80",
            selected && "stroke-primary",
            pendingConnect && "stroke-amber-500",
          )}
          strokeDasharray={node.locked ? "6 5" : undefined}
          strokeWidth={selected || pendingConnect ? 3 : 1.8}
        />
        {node.label ? (
          <text
            x={node.width / 2}
            y={node.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            pointerEvents="none"
            className="fill-foreground text-[24px] font-semibold"
          >
            {node.label}
          </text>
        ) : null}
        {selected && !node.locked ? (
          <SelectionHandles
            node={node}
            onResizePointerDown={onResizePointerDown}
            onRotatePointerDown={onRotatePointerDown}
          />
        ) : null}
        {node.locked ? <NodeLockBadge x={node.width - 8} y="-8" /> : null}
      </g>
    );
  }

  if (node.kind === "frame") {
    return (
      <g
        transform={transform}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <rect
          width={node.width}
          height={node.height}
          rx="22"
          className={cn("fill-background/20 dark:fill-zinc-900/70", selectedClass)}
          strokeDasharray={node.locked ? "8 7" : undefined}
          strokeWidth={selected ? 4 : 3}
        />
        <rect
          x="16"
          y="16"
          width={Math.max(0, node.width - 32)}
          height={Math.max(0, node.height - 32)}
          fill={`url(#${frameDotsId})`}
          className="text-muted-foreground dark:text-zinc-500"
          opacity="0.65"
        />
        {selected && !node.locked ? (
          <SelectionHandles
            node={node}
            onResizePointerDown={onResizePointerDown}
            onRotatePointerDown={onRotatePointerDown}
          />
        ) : null}
        {node.locked ? <NodeLockBadge x={node.width - 10} y={-10} /> : null}
      </g>
    );
  }

  if (node.kind === "circle") {
    return (
      <g
        transform={transform}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <ellipse
          cx={node.width / 2}
          cy={node.height / 2}
          rx={node.width / 2}
          ry={node.height / 2}
          fill="none"
          className={selectedClass}
          strokeDasharray={node.locked ? "6 5" : undefined}
          strokeWidth={selected || pendingConnect ? 3 : 1.5}
        />
        {selected && !node.locked ? (
          <SelectionHandles
            node={node}
            onResizePointerDown={onResizePointerDown}
            onRotatePointerDown={onRotatePointerDown}
          />
        ) : null}
        {node.locked ? <NodeLockBadge x={node.width - 8} y="-8" /> : null}
      </g>
    );
  }

  if (node.kind === "text") {
    const lines = textNodeLines(node.label || "Text");
    const lineHeight = 28;
    const firstLineY = node.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    return (
      <g
        transform={transform}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <rect
          width={node.width}
          height={node.height}
          rx="8"
          fill="transparent"
          className={cn(selected ? "stroke-primary" : "stroke-transparent")}
          strokeDasharray="5 5"
          strokeWidth="1.5"
        />
        <text
          x={node.width / 2}
          y={node.height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className={cn(
            "fill-foreground text-[24px] font-medium",
            editing && "opacity-0",
          )}
        >
          {lines.map((line, index) => (
            <tspan
              key={`${line}-${index}`}
              x={node.width / 2}
              y={firstLineY + index * lineHeight}
            >
              {line}
            </tspan>
          ))}
        </text>
        {editing ? (
          <foreignObject x="0" y="0" width={node.width} height={node.height}>
            <div className="flex h-full items-center">
              <textarea
                autoFocus
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                className="w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-center text-[24px] font-medium leading-[28px] text-foreground shadow-none outline-none ring-0 [appearance:none]"
                style={{
                  height: Math.min(
                    node.height,
                    Math.max(lineHeight, lines.length * lineHeight),
                  ),
                }}
                placeholder="Text"
                value={node.label}
                onPointerDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onChange={(event: ReactChangeEvent<HTMLTextAreaElement>) =>
                  onTextChange(event.target.value)
                }
                onBlur={onTextEditEnd}
                onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                  if (event.key === "Escape") {
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          </foreignObject>
        ) : null}
        {selected && !node.locked ? (
          <SelectionHandles
            node={node}
            onResizePointerDown={onResizePointerDown}
            onRotatePointerDown={onRotatePointerDown}
          />
        ) : null}
        {node.locked ? <NodeLockBadge x={node.width} y="0" /> : null}
      </g>
    );
  }

  if (node.kind === "image") {
    return (
      <g
        transform={transform}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <rect
          width={node.width}
          height={node.height}
          rx="12"
          className={cn("fill-background stroke-border", selectedClass)}
          strokeDasharray={node.locked ? "6 5" : undefined}
          strokeWidth={selected || pendingConnect ? 3 : 1.5}
        />
        {node.imageUrl ? (
          <image
            href={node.imageUrl}
            x="1"
            y="1"
            width={node.width - 2}
            height={node.height - 2}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <foreignObject x="0" y="0" width={node.width} height={node.height}>
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <HugeiconsIcon icon={ImageAdd01Icon} size={24} />
              <div className="text-[12px] font-medium">Image</div>
            </div>
          </foreignObject>
        )}
        {selected && !node.locked ? (
          <SelectionHandles
            node={node}
            onResizePointerDown={onResizePointerDown}
            onRotatePointerDown={onRotatePointerDown}
          />
        ) : null}
        {node.locked ? <NodeLockBadge x={node.width - 8} y="-8" /> : null}
      </g>
    );
  }

  if (node.kind === "terminal") {
    return null;
  }

  return (
    <g
      transform={transform}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className={nodeClassName}
    >
      {node.kind === "boundary" ? (
        <rect
          width={node.width}
          height={node.height}
          rx="12"
          fill="none"
          strokeDasharray={node.locked ? "4 4" : "8 7"}
          className={cn(
            "stroke-border",
            selected && "stroke-primary",
            pendingConnect && "stroke-amber-500",
          )}
          strokeWidth={selected || pendingConnect ? 3 : 1.5}
        />
      ) : (
        <rect
          width={node.width}
          height={node.height}
          rx={node.kind === "database" ? 18 : 10}
          className={cn(
            "fill-background stroke-border",
            selected && "stroke-primary",
            pendingConnect && "stroke-amber-500",
          )}
          strokeDasharray={node.locked ? "6 5" : undefined}
          strokeWidth={selected || pendingConnect ? 3 : 1.5}
        />
      )}
      {node.kind === "database" ? (
        <path
          d={`M 0 22 C 0 5, ${node.width} 5, ${node.width} 22`}
          fill="none"
          className="stroke-border"
          strokeWidth="1.5"
        />
      ) : null}
      <foreignObject x="12" y="12" width={node.width - 24} height={node.height - 24}>
        <div className="flex h-full min-w-0 items-center gap-2">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md border",
              shape.tone,
            )}
          >
            <HugeiconsIcon icon={shape.icon} size={17} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-foreground">
              {node.label || shape.label}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {node.technology || shape.description}
            </div>
          </div>
        </div>
      </foreignObject>
      {node.locked ? <NodeLockBadge x={node.width - 8} y="-8" /> : null}
    </g>
  );
}
