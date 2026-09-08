import type { CanvasLayerProps } from "../lib/useCanvasLayerProps";
import { CanvasBackgroundMedia } from "./CanvasBackgroundMedia";
import { CanvasDiagramSvg } from "./CanvasDiagramSvg";
import { CanvasInteractionOverlays } from "./CanvasInteractionOverlays";
import { CanvasTerminalLayer } from "./CanvasTerminalLayer";

/** Render-only seam for the independent Canvas viewport layers. */
export function CanvasRenderSurface({
  backgroundImageId,
  diagram,
  terminalLayer,
  overlays,
}: CanvasLayerProps) {
  return (
    <div className="min-h-0 flex-1">
      <main
        data-canvas-surface-viewport="true"
        className="relative h-full min-h-0 overflow-hidden bg-[#fbfdfc] dark:bg-zinc-950"
      >
        <CanvasBackgroundMedia imageId={backgroundImageId} />
        <CanvasDiagramSvg {...diagram} />
        <CanvasTerminalLayer {...terminalLayer} />
        <CanvasInteractionOverlays {...overlays} />
      </main>
    </div>
  );
}
