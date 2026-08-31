import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = [
  readFileSync(new URL("./useCanvasTerminalInteractions.ts", import.meta.url), "utf8"),
  readFileSync(new URL("./canvasTerminalInteractionCommit.ts", import.meta.url), "utf8"),
].join("\n");

describe("terminal group close contract", () => {
  it("removes group terminals and connected edges while clearing transient state", () => {
    expect(source).toContain("export function commitTerminalGroupClose");
    expect(source).toContain("layoutTerminalDockGroups([group])");
    expect(source).toContain("!terminalIds.includes(item.id)");
    expect(source).toContain("!terminalIds.includes(item.from)");
    expect(source).toContain("setActiveTerminalId(\"\")");
    expect(source).toContain("clearSelection();");
  });
});
