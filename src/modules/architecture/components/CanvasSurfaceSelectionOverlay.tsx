import { cn } from "@/lib/utils";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  ArchitectureNode,
  ResizeHandle,
} from "../lib/architectureCanvasTypes";

const RESIZE_CORNERS: Array<{
  handle: ResizeHandle;
  className: string;
}> = [
  { handle: "nw", className: "-left-2 -top-2 cursor-nw-resize" },
  { handle: "ne", className: "-right-2 -top-2 cursor-ne-resize" },
  { handle: "se", className: "-bottom-2 -right-2 cursor-se-resize" },
  { handle: "sw", className: "-bottom-2 -left-2 cursor-sw-resize" },
];

export function CanvasSurfaceSelectionOverlay({
  node,
  bounds,
  selectionBounds,
  selected,
  onResizePointerDown,
}: {
  node: ArchitectureNode;
  bounds: { x: number; y: number; width: number; height: number };
  selectionBounds: { x: number; y: number; width: number; height: number };
  selected: boolean;
  onResizePointerDown: (
    event: ReactPointerEvent<SVGRectElement>,
    node: ArchitectureNode,
    handle: ResizeHandle,
  ) => void;
}) {
  if (!selected || node.locked) return null;
  return (
    <div
      className="pointer-events-none absolute rounded-[12px] border-2 border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.16),0_8px_24px_rgba(59,130,246,0.20)]"
      style={{
        left: `${((selectionBounds.x - bounds.x) / bounds.width) * 100}%`,
        top: `${((selectionBounds.y - bounds.y) / bounds.height) * 100}%`,
        width: `${(selectionBounds.width / bounds.width) * 100}%`,
        height: `${(selectionBounds.height / bounds.height) * 100}%`,
      }}
    >
      {RESIZE_CORNERS.map((corner) => (
        <button
          key={corner.handle}
          type="button"
          aria-label={`Resize ${node.kind} from ${corner.handle} corner`}
          className={cn(
            "pointer-events-auto absolute size-5 border-0 bg-transparent p-0 outline-none",
            corner.className,
          )}
          onPointerDown={(event) =>
            onResizePointerDown(
              event as unknown as ReactPointerEvent<SVGRectElement>,
              node,
              corner.handle,
            )
          }
        />
      ))}
    </div>
  );
}
