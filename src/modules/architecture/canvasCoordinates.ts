type CanvasView = {
  x: number;
  y: number;
  scale: number;
};

type TerminalWorldTransform = {
  translateX: number;
  translateY: number;
  scale: number;
};

/**
 * The application shell scales `.zoom-content`, while the SVG cancels that
 * scale through its inverse layout size. Canvas terminals live in an HTML
 * layer, so they need this compensation to share the SVG's screen space.
 */
export function terminalWorldTransform(
  view: CanvasView,
  appZoom: number,
): TerminalWorldTransform {
  const safeAppZoom = appZoom > 0 ? appZoom : 1;
  const scale = view.scale / safeAppZoom;

  return {
    translateX: -view.x * scale,
    translateY: -view.y * scale,
    scale,
  };
}
