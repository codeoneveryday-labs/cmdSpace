import { describe, expect, it } from "vitest";
import type { ArchitectureTerminalDockGroup } from "@/modules/tabs";
import {
  layoutTerminalDockGroups,
  resolveTerminalDockDrop,
} from "./terminalDockGeometry";

const group: ArchitectureTerminalDockGroup = {
  id: "group",
  x: 0,
  y: 0,
  width: 1000,
  height: 600,
  root: {
    id: "stack",
    kind: "tabs",
    terminalIds: ["one", "two"],
    activeTerminalId: "one",
  },
};

describe("terminalDockGeometry", () => {
  it("lays out a stack and resolves its tab drop zone", () => {
    const [stack] = layoutTerminalDockGroups([group]);
    expect(stack).toMatchObject({
      groupId: "group",
      stackId: "stack",
      rect: { x: 0, y: 0, width: 1000, height: 600 },
    });
    expect(resolveTerminalDockDrop({ x: 500, y: 20 }, [stack], "source")).toEqual({
      kind: "tab",
      groupId: "group",
      stackId: "stack",
    });
  });
});
