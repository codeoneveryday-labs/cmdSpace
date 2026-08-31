import type { TerminalDockDropTarget } from "../terminalDockLayout";
import type { TerminalPlacement } from "../terminalPlacement";
import { CanvasPlacementOverlay } from "./CanvasPlacementOverlay";
import { CanvasStatusOverlay } from "./CanvasStatusOverlay";

export function CanvasInteractionOverlays({
  terminalDropPreview,
  terminalDockDropTarget,
  terminalDockIndicator,
  view,
  viewWidth,
  viewHeight,
  terminalPlacements,
  pendingSurfaceKind,
  isFreeTerminalPlacement,
  nodeCount,
  edgeCount,
  zoom,
  canvasFocused,
  onToggleCanvasFocus,
  onPlaceFreeSurface,
  onPlaceSurface,
}: {
  terminalDropPreview: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  terminalDockDropTarget: TerminalDockDropTarget | null;
  terminalDockIndicator: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  view: { x: number; y: number };
  viewWidth: number;
  viewHeight: number;
  terminalPlacements: TerminalPlacement[];
  pendingSurfaceKind: "terminal" | "browser" | null;
  isFreeTerminalPlacement: boolean;
  nodeCount: number;
  edgeCount: number;
  zoom: number;
  canvasFocused: boolean;
  onToggleCanvasFocus?: () => void;
  onPlaceFreeSurface: (point: { clientX: number; clientY: number }) => void;
  onPlaceSurface: (placement: TerminalPlacement) => void;
}) {
  return (
    <>
      {terminalDropPreview ? (
        <div
          className="pointer-events-none absolute z-10 flex items-center justify-center rounded-[12px] border-2 border-blue-500 bg-blue-500/[0.12] shadow-[0_10px_30px_rgba(59,130,246,0.22)]"
          style={{
            left: `${((terminalDropPreview.x - view.x) / viewWidth) * 100}%`,
            top: `${((terminalDropPreview.y - view.y) / viewHeight) * 100}%`,
            width: `${(terminalDropPreview.width / viewWidth) * 100}%`,
            height: `${(terminalDropPreview.height / viewHeight) * 100}%`,
          }}
        >
          <span className="rounded-full bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            Drop to place
          </span>
        </div>
      ) : null}

      {terminalDockDropTarget && terminalDockIndicator ? (
        <div
          data-terminal-drop-target={
            terminalDockDropTarget.kind === "tab"
              ? "tab"
              : `split-${terminalDockDropTarget.edge}`
          }
          className="pointer-events-none absolute z-20 flex items-center justify-center rounded-md border-2 border-blue-500/60 bg-blue-500/[0.12] text-blue-600 shadow-[0_8px_24px_rgba(59,130,246,0.16)] dark:text-blue-300"
          style={{
            left: `${((terminalDockIndicator.x - view.x) / viewWidth) * 100}%`,
            top: `${((terminalDockIndicator.y - view.y) / viewHeight) * 100}%`,
            width: `${(terminalDockIndicator.width / viewWidth) * 100}%`,
            height:
              terminalDockDropTarget.kind === "tab"
                ? "38px"
                : `${(terminalDockIndicator.height / viewHeight) * 100}%`,
          }}
        >
          <span className="rounded-full bg-blue-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            {terminalDockDropTarget.kind === "tab"
              ? "+ Tab"
              : `Split ${terminalDockDropTarget.edge}`}
          </span>
        </div>
      ) : null}

      <CanvasPlacementOverlay
        placements={terminalPlacements}
        pendingSurfaceKind={pendingSurfaceKind}
        isFreeTerminalPlacement={isFreeTerminalPlacement}
        view={view}
        viewWidth={viewWidth}
        viewHeight={viewHeight}
        onPlaceFreeSurface={onPlaceFreeSurface}
        onPlaceSurface={onPlaceSurface}
      />

      <CanvasStatusOverlay
        nodeCount={nodeCount}
        edgeCount={edgeCount}
        zoom={zoom}
        canvasFocused={canvasFocused}
        onToggleCanvasFocus={onToggleCanvasFocus}
      />
    </>
  );
}
