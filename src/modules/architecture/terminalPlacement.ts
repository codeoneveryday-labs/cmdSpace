export type TerminalPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Viewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const GAP = 40;
const TERMINAL_WIDTH = 640;
const TERMINAL_HEIGHT = 400;

/**
 * Builds the same quick-pick layout Cate uses: six visible, non-overlapping
 * ghosts, ranked from the upper-left. Existing canvas items are treated as
 * obstacles so an accepted terminal never begins on top of another item.
 */
export function recommendTerminalPlacements(
  viewport: Viewport,
  occupied: TerminalPlacement[],
  anchor?: TerminalPlacement,
  size: Pick<TerminalPlacement, "width" | "height"> = {
    width: TERMINAL_WIDTH,
    height: TERMINAL_HEIGHT,
  },
): TerminalPlacement[] {
  const origin = anchor
    ? {
        x: anchor.x - size.width - GAP,
        y: anchor.y - size.height - GAP,
      }
    : { x: viewport.x + GAP, y: viewport.y + GAP };
  const slots = anchor
    ? [
      [0, 0], [1, 0], [2, 0],
        [0, 1], [2, 1],
        [1, 2],
      ]
    : [
        [0, 0], [1, 0], [2, 0],
        [0, 1], [1, 1], [2, 1],
      ];
  const placed: TerminalPlacement[] = [];

  for (const [column, row] of slots) {
    const candidate = {
      x: origin.x + column * (size.width + GAP),
      y: origin.y + row * (size.height + GAP),
      width: size.width,
      height: size.height,
    };
    placed.push(nudgeBelowObstacles(candidate, [...occupied, ...placed]));
  }

  return placed;
}

function nudgeBelowObstacles(
  candidate: TerminalPlacement,
  obstacles: TerminalPlacement[],
): TerminalPlacement {
  let result = candidate;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const overlap = obstacles.find((obstacle) => overlaps(result, obstacle));
    if (!overlap) return result;
    result = { ...result, y: overlap.y + overlap.height + GAP };
  }
  return result;
}

function overlaps(left: TerminalPlacement, right: TerminalPlacement) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}
