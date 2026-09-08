import { describe, expect, it } from "vitest";
import {
  needsTerminalSizeMigration,
  normalizeDiagramSeed,
} from "./architectureDiagramNormalization";

describe("architectureDiagramNormalization", () => {
  it("hydrates legacy diagrams as architecture canvases", () => {
    expect(normalizeDiagramSeed({ nodes: [], edges: [] })).toEqual({
      nodes: [],
      edges: [],
      terminalDockGroups: [],
    });
  });

  it("drops unknown metadata from persisted diagrams", () => {
    const normalized = normalizeDiagramSeed(({
      legacyCanvasMode: "retired",
      legacyRunId: "run-1",
      nodes: [],
      edges: [],
    } as unknown) as Parameters<typeof normalizeDiagramSeed>[0]);

    expect(normalized).not.toHaveProperty("legacyCanvasMode");
    expect(normalized).not.toHaveProperty("legacyRunId");
  });

  it("migrates legacy narrow terminal dimensions only once", () => {
    expect(
      needsTerminalSizeMigration({
        kind: "terminal",
        width: 420,
        height: 280,
      }),
    ).toBe(true);
    expect(
      needsTerminalSizeMigration({
        kind: "terminal",
        width: 640,
        height: 400,
        terminalChromeVersion: 2,
      }),
    ).toBe(false);
  });

  it("drops invalid and duplicate nodes while retaining valid edges only", () => {
    const normalized = normalizeDiagramSeed({
      nodes: [
        { id: "a", kind: "service", x: 0, y: 0, width: 10, height: 10 },
        { id: "a", kind: "service", x: 1, y: 1, width: 10, height: 10 },
        { id: "bad", kind: "unknown", x: 0, y: 0, width: 10, height: 10 },
        { id: "legacy-browser", kind: "browser", x: 0, y: 0, width: 10, height: 10, url: "https://example.com" },
      ],
      edges: [
        { id: "e1", from: "a", to: "a", label: "ok" },
        { id: "e2", from: "a", to: "bad", label: "drop" },
      ],
    } as never);

    expect(normalized.nodes).toHaveLength(1);
    expect(normalized.edges).toEqual([
      { id: "e1", from: "a", to: "a", label: "ok" },
    ]);
  });
});
