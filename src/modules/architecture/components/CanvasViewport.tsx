import type { ComponentProps } from "react";
import { CanvasBackgroundMedia } from "./CanvasBackgroundMedia";
import { CanvasBrowserLayer } from "./CanvasBrowserLayer";
import { CanvasDiagramSvg } from "./CanvasDiagramSvg";
import { CanvasInteractionOverlays } from "./CanvasInteractionOverlays";
import { CanvasTerminalLayer } from "./CanvasTerminalLayer";

type CanvasViewportProps = {
  backgroundImageId: ComponentProps<typeof CanvasBackgroundMedia>["imageId"];
  diagram: ComponentProps<typeof CanvasDiagramSvg>;
  terminalLayer: ComponentProps<typeof CanvasTerminalLayer>;
  browserLayer: ComponentProps<typeof CanvasBrowserLayer>;
  overlays: ComponentProps<typeof CanvasInteractionOverlays>;
};

export function CanvasViewport({
  backgroundImageId,
  diagram,
  terminalLayer,
  browserLayer,
  overlays,
}: CanvasViewportProps) {
  return (
    <div className="min-h-0 flex-1">
      <main
        data-canvas-surface-viewport="true"
        className="relative h-full min-h-0 overflow-hidden bg-[#fbfdfc] dark:bg-zinc-950"
      >
        <CanvasBackgroundMedia imageId={backgroundImageId} />
        <CanvasDiagramSvg {...diagram} />
        <CanvasTerminalLayer {...terminalLayer} />
        <CanvasBrowserLayer {...browserLayer} />
        <CanvasInteractionOverlays {...overlays} />
      </main>
    </div>
  );
}
