import { describe, expect, it } from "vitest";
import { buildPersistedCanvasDiagram } from "./canvasDiagramPersistenceModel";

describe("buildPersistedCanvasDiagram", () => {
  it("preserves Canvas purpose and run identity with layout metadata", () => {
    expect(
      buildPersistedCanvasDiagram({
        canvasPurpose: "orchestration",
        orchestrationProvider: "claude",
        orchestrationRunId: "run-1",
        nodes: [],
        edges: [],
        terminalDockGroups: [],
      }),
    ).toEqual({
      canvasPurpose: "orchestration",
      orchestrationProvider: "claude",
      orchestrationRunId: "run-1",
      nodes: [],
      edges: [],
      terminalDockGroups: [],
    });
  });
});
