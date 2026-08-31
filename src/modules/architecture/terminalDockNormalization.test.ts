import { describe, expect, it } from "vitest";
import type { ArchitectureDiagramNode } from "@/modules/tabs";
import { normalizeTerminalDockGroups } from "./terminalDockNormalization";

const terminal = (id: string): ArchitectureDiagramNode => ({
  id,
  kind: "terminal",
  label: id,
  technology: "zsh",
  x: 10,
  y: 20,
  width: 640,
  height: 400,
});

describe("terminalDockNormalization", () => {
  it("repairs persisted membership and restores terminal orphans", () => {
    const groups = normalizeTerminalDockGroups([terminal("one"), terminal("two")], [
      {
        id: "saved",
        x: 0,
        y: 0,
        width: 800,
        height: 500,
        root: {
          id: "tabs",
          kind: "tabs",
          terminalIds: ["one", "missing", "one"],
          activeTerminalId: "missing",
        },
      },
    ]);

    expect(groups).toMatchObject([
      { id: "saved", root: { terminalIds: ["one"], activeTerminalId: "one" } },
      { root: { terminalIds: ["two"], activeTerminalId: "two" } },
    ]);
  });
});
