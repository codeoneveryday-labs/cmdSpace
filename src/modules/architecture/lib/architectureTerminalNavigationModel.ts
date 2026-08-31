import type { ArchitectureNode } from "./architectureCanvasTypes";

/** Pick the terminal node closest in the given direction from `current`. */
export function findNearestTerminalInDirection(
  current: ArchitectureNode,
  candidates: ArchitectureNode[],
  direction: "left" | "right" | "up" | "down",
): ArchitectureNode | null {
  const currentCenter = {
    x: current.x + current.width / 2,
    y: current.y + current.height / 2,
  };
  return candidates.reduce<ArchitectureNode | null>((nearest, node) => {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    let valid = false;
    let primary = 0;
    let secondary = Math.abs(cy - currentCenter.y);
    if (direction === "left") {
      valid = cx < currentCenter.x - 2;
      primary = currentCenter.x - cx;
    } else if (direction === "right") {
      valid = cx > currentCenter.x + 2;
      primary = cx - currentCenter.x;
    } else if (direction === "up") {
      valid = cy < currentCenter.y - 2;
      primary = currentCenter.y - cy;
      secondary = Math.abs(cx - currentCenter.x);
    } else if (direction === "down") {
      valid = cy > currentCenter.y + 2;
      primary = cy - currentCenter.y;
      secondary = Math.abs(cx - currentCenter.x);
    }
    if (!valid) return nearest;
    if (!nearest) return node;

    const nearestCx = nearest.x + nearest.width / 2;
    const nearestCy = nearest.y + nearest.height / 2;
    let nearestPrimary = 0;
    let nearestSecondary = Math.abs(nearestCy - currentCenter.y);
    if (direction === "left") {
      nearestPrimary = currentCenter.x - nearestCx;
    } else if (direction === "right") {
      nearestPrimary = nearestCx - currentCenter.x;
    } else if (direction === "up") {
      nearestPrimary = currentCenter.y - nearestCy;
      nearestSecondary = Math.abs(nearestCx - currentCenter.x);
    } else if (direction === "down") {
      nearestPrimary = nearestCy - currentCenter.y;
      nearestSecondary = Math.abs(nearestCx - currentCenter.x);
    }
    return primary < nearestPrimary - 0.5 ||
      (Math.abs(primary - nearestPrimary) <= 0.5 && secondary < nearestSecondary)
      ? node
      : nearest;
  }, null);
}
