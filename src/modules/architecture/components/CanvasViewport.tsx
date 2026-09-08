import type { CanvasLayerProps } from "../lib/useCanvasLayerProps";
import { CanvasRenderSurface } from "./CanvasRenderSurface";

export type CanvasViewportProps = CanvasLayerProps;

export function CanvasViewport({
  backgroundImageId,
  diagram,
  terminalLayer,
  overlays,
}: CanvasViewportProps) {
  return (
    <CanvasRenderSurface
      backgroundImageId={backgroundImageId}
      diagram={diagram}
      terminalLayer={terminalLayer}
      overlays={overlays}
    />
  );
}
