import { describe, expect, it } from "vitest";
import {
  isDrawingOnlyKind,
  isLiveSurfaceKind,
  isResizableShapeKind,
  isShapeDrawingMode,
} from "./architectureCanvasPredicates";

describe("architectureCanvasPredicates", () => {
  it("classifies canvas shape and live-surface kinds", () => {
    expect(isShapeDrawingMode("rectangle")).toBe(true);
    expect(isShapeDrawingMode("select")).toBe(false);
    expect(isLiveSurfaceKind("browser")).toBe(true);
    expect(isLiveSurfaceKind("database")).toBe(false);
    expect(isResizableShapeKind("terminal")).toBe(true);
    expect(isResizableShapeKind("line")).toBe(false);
    expect(isDrawingOnlyKind("pen")).toBe(true);
    expect(isDrawingOnlyKind("text")).toBe(false);
  });
});
