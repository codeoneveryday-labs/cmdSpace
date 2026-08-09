export type BrowserBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function intersectBrowserBounds(
  bounds: BrowserBounds,
  viewport: BrowserBounds,
): BrowserBounds | null {
  const left = Math.max(bounds.left, viewport.left);
  const top = Math.max(bounds.top, viewport.top);
  const right = Math.min(
    bounds.left + bounds.width,
    viewport.left + viewport.width,
  );
  const bottom = Math.min(
    bounds.top + bounds.height,
    viewport.top + viewport.height,
  );

  if (right <= left || bottom <= top) return null;

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}
