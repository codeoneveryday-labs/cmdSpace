import { describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type {
  ArchitectureDiagramEdge,
  ArchitectureDiagramNode,
  ArchitectureTerminalDockGroup,
} from "@/modules/tabs";

import { commitTerminalGroupClose } from "./canvasTerminalInteractionCommit";

function terminal(id: string): ArchitectureDiagramNode {
  return {
    id,
    kind: "terminal",
    label: id,
    technology: "zsh",
    x: 0,
    y: 0,
    width: 640,
    height: 400,
  };
}

function stateSetter<T>(read: () => T, write: (next: T) => void): Dispatch<SetStateAction<T>> {
  return ((update: SetStateAction<T>) => {
    if (typeof update === "function") {
      write((update as (previous: T) => T)(read()));
      return;
    }
    write(update);
  }) as Dispatch<SetStateAction<T>>;
}

describe("commitTerminalGroupClose", () => {
  it("removes grouped terminals, related edges, and transient terminal state", () => {
    const group: ArchitectureTerminalDockGroup = {
      id: "group-1",
      x: 0,
      y: 0,
      width: 640,
      height: 400,
      root: {
        id: "stack-1",
        kind: "tabs",
        terminalIds: ["terminal-a", "terminal-b"],
        activeTerminalId: "terminal-a",
      },
    };
    let nodes = [terminal("terminal-a"), terminal("terminal-b"), terminal("other")];
    let edges: ArchitectureDiagramEdge[] = [
      { id: "removed-out", from: "terminal-a", to: "other", label: "" },
      { id: "removed-in", from: "other", to: "terminal-b", label: "" },
      { id: "kept", from: "other", to: "other-2", label: "" },
    ];
    let groups = [group];
    let activeTerminalId = "terminal-a";
    let maximizedTerminalId = "terminal-b";
    const pushHistory = vi.fn();
    const clearSelection = vi.fn();
    const setConnectSourceId = vi.fn();

    commitTerminalGroupClose({
      group,
      activeTerminalId,
      maximizedTerminalId,
      pushHistory,
      setNodes: stateSetter(() => nodes, (next) => { nodes = next; }),
      setEdges: stateSetter(() => edges, (next) => { edges = next; }),
      setTerminalDockGroups: stateSetter(() => groups, (next) => { groups = next; }),
      setActiveTerminalId: stateSetter(
        () => activeTerminalId,
        (next) => { activeTerminalId = next; },
      ),
      setMaximizedTerminalId: stateSetter(
        () => maximizedTerminalId,
        (next) => { maximizedTerminalId = next; },
      ),
      clearSelection,
      setConnectSourceId,
    });

    expect(pushHistory).toHaveBeenCalledOnce();
    expect(nodes.map((node) => node.id)).toEqual(["other"]);
    expect(edges.map((edge) => edge.id)).toEqual(["kept"]);
    expect(groups).toEqual([]);
    expect(activeTerminalId).toBe("");
    expect(maximizedTerminalId).toBe("");
    expect(clearSelection).toHaveBeenCalledOnce();
    expect(setConnectSourceId).toHaveBeenCalledWith(null);
  });
});
