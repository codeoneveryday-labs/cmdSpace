import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "useCanvasDiagramPersistence.ts",
  ),
  "utf8",
);

describe("useCanvasDiagramPersistence contract", () => {
  it("persists the complete diagram snapshot when any owned part changes", () => {
    expect(source).toContain("onDiagramChange?.(tabId, { nodes, edges, terminalDockGroups })");
    expect(source).toContain("[edges, nodes, onDiagramChange, tabId, terminalDockGroups]");
  });
});
