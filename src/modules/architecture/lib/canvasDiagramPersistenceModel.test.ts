import { describe, expect, it } from "vitest";
import { buildPersistedCanvasDiagram } from "./canvasDiagramPersistenceModel";

describe("buildPersistedCanvasDiagram", () => {
  it("persists only architecture layout metadata", () => {
    expect(
      buildPersistedCanvasDiagram({
        nodes: [],
        edges: [],
        terminalDockGroups: [],
      }),
    ).toEqual({
      nodes: [],
      edges: [],
      terminalDockGroups: [],
    });
  });
});
