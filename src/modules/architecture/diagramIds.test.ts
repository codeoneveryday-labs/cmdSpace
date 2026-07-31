import { describe, expect, it } from "vitest";
import { nextDiagramIdSequence } from "./diagramIds";

describe("nextDiagramIdSequence", () => {
  it("continues after IDs restored from a saved canvas", () => {
    expect(nextDiagramIdSequence(["n1", "n2"], "n")).toBe(3);
  });

  it("uses the highest matching numeric suffix", () => {
    expect(nextDiagramIdSequence(["n1", "n12", "n4"], "n")).toBe(13);
  });

  it("ignores IDs from other namespaces and non-numeric IDs", () => {
    expect(
      nextDiagramIdSequence(["e9", "terminal-custom", "n-custom"], "n"),
    ).toBe(1);
  });

  it("starts at one for an empty diagram", () => {
    expect(nextDiagramIdSequence([], "e")).toBe(1);
  });
});
