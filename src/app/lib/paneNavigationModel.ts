export type PaneDirection = "left" | "right" | "up" | "down";

export type PanePoint = { x: number; y: number };
export type PaneCandidate = { id: number; center: PanePoint };

export function selectDirectionalPane(
  activeCenter: PanePoint,
  candidates: PaneCandidate[],
  direction: PaneDirection,
): number | null {
  const scored = candidates.flatMap(({ id, center }) => {
    const deltaX = center.x - activeCenter.x;
    const deltaY = center.y - activeCenter.y;
    let primaryDistance: number;
    let secondaryDistance: number;

    if (direction === "left") {
      if (center.x >= activeCenter.x - 2) return [];
      primaryDistance = -deltaX;
      secondaryDistance = Math.abs(deltaY);
    } else if (direction === "right") {
      if (center.x <= activeCenter.x + 2) return [];
      primaryDistance = deltaX;
      secondaryDistance = Math.abs(deltaY);
    } else if (direction === "up") {
      if (center.y >= activeCenter.y - 2) return [];
      primaryDistance = -deltaY;
      secondaryDistance = Math.abs(deltaX);
    } else {
      if (center.y <= activeCenter.y + 2) return [];
      primaryDistance = deltaY;
      secondaryDistance = Math.abs(deltaX);
    }

    return [{ id, score: primaryDistance + 3 * secondaryDistance }];
  });

  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.id ?? null;
}
