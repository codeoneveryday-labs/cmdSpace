export type PanStart = {
  clientX: number;
  clientY: number;
  viewX: number;
  viewY: number;
};

/** Convert a fixed screen-space drag delta into canvas coordinates. */
export function panViewFromPointer(
  start: PanStart,
  pointer: Pick<PanStart, "clientX" | "clientY">,
  scale: number,
) {
  return {
    x: start.viewX - (pointer.clientX - start.clientX) / scale,
    y: start.viewY - (pointer.clientY - start.clientY) / scale,
  };
}
