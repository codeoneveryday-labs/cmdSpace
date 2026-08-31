export function clampDockDividerRatio(ratio: number): number {
  return Math.max(0.1, Math.min(0.9, ratio));
}

export function dockDividerKeyboardDelta({
  direction,
  key,
  shiftKey,
}: {
  direction: "horizontal" | "vertical";
  key: string;
  shiftKey: boolean;
}): number | null {
  const step = shiftKey ? 0.1 : 0.05;
  if (direction === "horizontal") {
    if (key === "ArrowLeft") return -step;
    if (key === "ArrowRight") return step;
    return null;
  }
  if (key === "ArrowUp") return -step;
  if (key === "ArrowDown") return step;
  return null;
}
