import { describe, expect, it } from "vitest";

import { recommendTerminalPlacements } from "./terminalPlacement";

describe("recommendTerminalPlacements", () => {
  it("offers six separated terminal spots across the visible canvas", () => {
    const placements = recommendTerminalPlacements(
      { x: 0, y: 0, width: 1200, height: 720 },
      [],
    );

    expect(placements).toHaveLength(6);
    for (const placement of placements) {
      expect(placement).toMatchObject({ width: 640, height: 400 });
    }
    for (let index = 0; index < placements.length; index += 1) {
      for (let other = index + 1; other < placements.length; other += 1) {
        expect(overlaps(placements[index], placements[other])).toBe(false);
      }
    }
  });

  it("moves recommendations away from terminals already on the canvas", () => {
    const occupied = { x: 28, y: 28, width: 364, height: 304 };
    const placements = recommendTerminalPlacements(
      { x: 0, y: 0, width: 1200, height: 720 },
      [occupied],
    );

    for (const placement of placements) {
      expect(overlaps(placement, occupied)).toBe(false);
    }
  });

  it("keeps a chosen terminal at the center of the next recommendation grid", () => {
    const anchor = { x: 680, y: 440, width: 640, height: 400 };
    const placements = recommendTerminalPlacements(
      { x: 0, y: 0, width: 1200, height: 720 },
      [anchor],
      anchor,
    );

    expect(placements).toHaveLength(6);
    expect(placements.every((placement) => !overlaps(placement, anchor))).toBe(true);
    expect(placements.some((placement) => placement.y < anchor.y)).toBe(true);
    expect(placements.some((placement) => placement.y > anchor.y)).toBe(true);
  });

  it("uses the requested surface size for browser and editor placement", () => {
    const placements = recommendTerminalPlacements(
      { x: 0, y: 0, width: 1400, height: 900 },
      [],
      undefined,
      { width: 720, height: 480 },
    );

    expect(placements).toHaveLength(6);
    expect(
      placements.every(({ width, height }) => width === 720 && height === 480),
    ).toBe(true);
  });
});

function overlaps(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}
