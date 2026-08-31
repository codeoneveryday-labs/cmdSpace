import { describe, expect, it } from "vitest";
import {
  cloneNode,
  fitTextNode,
  measureTextNodeSize,
  textNodeLines,
} from "./architectureTextModel";
import type { ArchitectureNode } from "./architectureCanvasTypes";

describe("architectureTextModel", () => {
  it("normalizes empty lines and sizes text from its longest line", () => {
    expect(textNodeLines("one\n\ntwo")).toEqual(["one", " ", "two"]);
    expect(measureTextNodeSize("short").width).toBe(112);
    expect(measureTextNodeSize("one\ntwo").height).toBe(70);
  });

  it("fits only text nodes and clones point arrays immutably", () => {
    const text = {
      id: "text",
      kind: "text",
      label: "a longer label",
      width: 1,
      height: 1,
      points: [{ x: 1, y: 2 }],
    } as unknown as ArchitectureNode;
    const fitted = fitTextNode(text);
    const cloned = cloneNode(text);

    expect(fitted.width).toBeGreaterThan(1);
    const rectangle = { ...text, kind: "rectangle" } as unknown as ArchitectureNode;
    expect(fitTextNode(rectangle)).toBe(rectangle);
    expect(cloned).not.toBe(text);
    expect(cloned.points).not.toBe(text.points);
  });
});
