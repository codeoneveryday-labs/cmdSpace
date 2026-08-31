import type { LiveSurfaceKind } from "../lib/architectureCanvasTypes";
import type { TerminalPlacement } from "../terminalPlacement";

export function CanvasPlacementOverlay({
  placements,
  pendingSurfaceKind,
  isFreeTerminalPlacement,
  view,
  viewWidth,
  viewHeight,
  onPlaceFreeSurface,
  onPlaceSurface,
}: {
  placements: TerminalPlacement[];
  pendingSurfaceKind: LiveSurfaceKind | null;
  isFreeTerminalPlacement: boolean;
  view: { x: number; y: number };
  viewWidth: number;
  viewHeight: number;
  onPlaceFreeSurface: (point: { clientX: number; clientY: number }) => void;
  onPlaceSurface: (placement: TerminalPlacement) => void;
}) {
  if (placements.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {isFreeTerminalPlacement ? (
        <div
          className="pointer-events-auto absolute inset-0 cursor-crosshair"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPlaceFreeSurface({
              clientX: event.clientX,
              clientY: event.clientY,
            });
          }}
        />
      ) : null}
      {placements.map((placement, index) => (
        <button
          key={`${placement.x}-${placement.y}`}
          type="button"
          aria-label={`Place ${pendingSurfaceKind ?? "surface"} in spot ${index + 1}`}
          className="pointer-events-auto absolute flex items-center justify-center rounded-lg border border-blue-400/70 bg-blue-500/[0.10] transition hover:border-blue-500 hover:bg-blue-500/[0.18] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{
            left: `${((placement.x - view.x) / viewWidth) * 100}%`,
            top: `${((placement.y - view.y) / viewHeight) * 100}%`,
            width: `${(placement.width / viewWidth) * 100}%`,
            height: `${(placement.height / viewHeight) * 100}%`,
          }}
          onClick={(event) => {
            event.stopPropagation();
            onPlaceSurface(placement);
          }}
        >
          <span className="flex flex-col items-center gap-1.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500 text-lg font-bold text-white shadow-lg">
              {index + 1}
            </span>
            {index === 0 ? (
              <span className="rounded-md bg-blue-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Best
              </span>
            ) : null}
          </span>
        </button>
      ))}
      <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full border border-zinc-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-lg backdrop-blur">
        {isFreeTerminalPlacement ? (
          <>Click anywhere to place · <kbd className="rounded border bg-zinc-100 px-1">F</kbd> to go back · <kbd className="rounded border bg-zinc-100 px-1">Esc</kbd> to cancel</>
        ) : (
          <>Pick a spot · <kbd className="rounded border bg-zinc-100 px-1">1</kbd>–<kbd className="rounded border bg-zinc-100 px-1">6</kbd> or click a ghost · <kbd className="rounded border bg-zinc-100 px-1">F</kbd> anywhere · <kbd className="rounded border bg-zinc-100 px-1">Esc</kbd> to cancel</>
        )}
      </div>
    </div>
  );
}
