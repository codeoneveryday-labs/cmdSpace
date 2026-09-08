import type { ComponentProps } from "react";

import type { CanvasBackgroundMedia } from "../components/CanvasBackgroundMedia";
import type { CanvasDiagramSvg } from "../components/CanvasDiagramSvg";
import type { CanvasInteractionOverlays } from "../components/CanvasInteractionOverlays";
import type { CanvasTerminalLayer } from "../components/CanvasTerminalLayer";

export type CanvasLayerProps = {
  backgroundImageId: ComponentProps<typeof CanvasBackgroundMedia>["imageId"];
  diagram: ComponentProps<typeof CanvasDiagramSvg>;
  terminalLayer: ComponentProps<typeof CanvasTerminalLayer>;
  overlays: ComponentProps<typeof CanvasInteractionOverlays>;
};
