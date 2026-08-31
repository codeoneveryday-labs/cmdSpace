import { describe, expect, it } from "vitest";
import {
  attachedTerminalGroupIdsForFrameMove,
  moveTerminalDockGroups,
  snapTerminalFrame,
  snapTextAttachment,
} from "./architectureCanvasAttachmentModel";

const node = (overrides: Record<string, unknown>) =>
  ({
    id: "node",
    kind: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...overrides,
  }) as never;

describe("architectureCanvasAttachmentModel", () => {
  it("snaps a text node to the nearest eligible shape", () => {
    expect(
      snapTextAttachment(
        node({ id: "text", kind: "text", x: 95, y: 40, width: 20, height: 20 }),
        [node({ id: "shape" }), node({ id: "line", kind: "line", x: 90 })],
      ),
    ).toEqual({ nodeId: "shape" });
  });

  it("snaps a terminal to the smallest containing frame", () => {
    expect(
      snapTerminalFrame(
        node({ id: "terminal", kind: "terminal", x: 40, y: 40, width: 20, height: 20 }),
        [
          node({ id: "large", kind: "frame", x: 0, y: 0, width: 100, height: 100 }),
          node({ id: "small", kind: "frame", x: 20, y: 20, width: 60, height: 60 }),
        ],
      ),
    ).toEqual({ nodeId: "small" });
  });

  it("moves only selected dock groups and preserves the others", () => {
    const groups = [
      { id: "selected", x: 1, y: 2, width: 10, height: 10 },
      { id: "other", x: 5, y: 6, width: 10, height: 10 },
    ] as never;
    expect(moveTerminalDockGroups(groups, new Set(["selected"]), 3, 4)).toEqual([
      { id: "selected", x: 4, y: 6, width: 10, height: 10 },
      { id: "other", x: 5, y: 6, width: 10, height: 10 },
    ]);
  });

  it("moves the dock group attached to a moved frame without moving its terminal node", () => {
    const frame = node({ id: "frame", kind: "frame", x: 0, y: 0, width: 400, height: 300 });
    const terminal = node({
      id: "terminal",
      kind: "terminal",
      frameId: "frame",
      x: 20,
      y: 20,
      width: 200,
      height: 120,
    });

    expect(
      attachedTerminalGroupIdsForFrameMove(
        [frame, terminal],
        [{ groupId: "dock", terminalIds: ["terminal"] }] as never,
        new Set(["frame"]),
      ),
    ).toEqual(new Set(["dock"]));
    expect(
      attachedTerminalGroupIdsForFrameMove(
        [frame, terminal],
        [{ groupId: "dock", terminalIds: ["terminal"] }] as never,
        new Set(["frame", "terminal"]),
      ),
    ).toEqual(new Set());
  });
});
