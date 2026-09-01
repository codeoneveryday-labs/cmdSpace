import { describe, expect, it } from "vitest";
import { selectDirectionalPane } from "./paneNavigationModel";

const active = { x: 100, y: 100 };
const candidates = [
  { id: 1, center: { x: 40, y: 100 } },
  { id: 2, center: { x: 160, y: 100 } },
  { id: 3, center: { x: 100, y: 40 } },
  { id: 4, center: { x: 100, y: 160 } },
];

describe("paneNavigationModel", () => {
  it.each([
    ["left", 1],
    ["right", 2],
    ["up", 3],
    ["down", 4],
  ] as const)("selects the pane %s", (direction, expected) => {
    expect(selectDirectionalPane(active, candidates, direction)).toBe(expected);
  });

  it("prefers the nearest candidate using the secondary-axis penalty", () => {
    expect(
      selectDirectionalPane(
        active,
        [
          { id: 1, center: { x: 70, y: 100 } },
          { id: 2, center: { x: 90, y: 80 } },
        ],
        "left",
      ),
    ).toBe(1);
  });

  it("returns null when no candidate is in the requested direction", () => {
    expect(selectDirectionalPane(active, candidates, "left")).toBe(1);
    expect(selectDirectionalPane(active, [], "right")).toBeNull();
  });
});
