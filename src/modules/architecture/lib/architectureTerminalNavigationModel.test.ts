import { describe, expect, it } from "vitest";
import { findNearestTerminalInDirection } from "./architectureTerminalNavigationModel";

const node = (id: string, x: number, y: number) =>
  ({ id, kind: "terminal", x, y, width: 10, height: 10 } as never);

describe("architectureTerminalNavigationModel", () => {
  it("chooses the closest candidate in the requested direction", () => {
    const current = node("current", 100, 100);
    expect(
      findNearestTerminalInDirection(
        current,
        [node("near", 120, 100), node("far", 180, 100), node("left", 70, 100)],
        "right",
      )?.id,
    ).toBe("near");
  });

  it("returns null when no candidate is in the requested direction", () => {
    expect(
      findNearestTerminalInDirection(
        node("current", 100, 100),
        [node("left", 70, 100)],
        "right",
      ),
    ).toBeNull();
  });
});
