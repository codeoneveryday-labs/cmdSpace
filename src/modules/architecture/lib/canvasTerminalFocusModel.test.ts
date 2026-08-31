import { describe, expect, it, vi } from "vitest";
import {
  focusTerminalNodeHandle,
  navigateTerminalFocus,
  registerTerminalHandle,
  type TerminalHandleMap,
} from "./canvasTerminalFocusModel";
import type { ArchitectureNode } from "./architectureCanvasTypes";
import type { CanvasTerminalHandle } from "../CanvasTerminalNode";
import { node } from "./architectureNodeFactory";

describe("canvasTerminalFocusModel", () => {
  const createMockHandle = (focusFn = vi.fn()): CanvasTerminalHandle => ({
    focus: focusFn,
    replaceCurrentInput: vi.fn(),
    getBuffer: vi.fn(() => "test buffer"),
    close: vi.fn(),
  });

  const createTestNode = (
    id: string,
    x: number,
    y: number,
  ): ArchitectureNode =>
    node(id, "terminal", `Terminal ${id}`, "zsh", x, y, 640, 400);

  it("registers and deletes handles in the handle map", () => {
    const map: TerminalHandleMap = new Map();
    const mockFocus = vi.fn();
    const handle = createMockHandle(mockFocus);

    registerTerminalHandle(map, "term-1", handle);
    expect(map.has("term-1")).toBe(true);

    const focused = focusTerminalNodeHandle(map, "term-1");
    expect(focused).toBe(true);
    expect(mockFocus).toHaveBeenCalledTimes(1);

    registerTerminalHandle(map, "term-1", null);
    expect(map.has("term-1")).toBe(false);
    expect(focusTerminalNodeHandle(map, "term-1")).toBe(false);
  });

  it("navigates to nearest terminal and focuses handle if available", () => {
    const map: TerminalHandleMap = new Map();
    const focusRight = vi.fn();
    map.set("n2", createMockHandle(focusRight));

    const n1 = createTestNode("n1", 0, 0);
    const n2 = createTestNode("n2", 700, 0);
    const n3 = createTestNode("n3", 0, 500);

    const target = navigateTerminalFocus("n1", [n1, n2, n3], "right", map);
    expect(target?.id).toBe("n2");
    expect(focusRight).toHaveBeenCalledTimes(1);
  });

  it("returns null if no node matches or no neighbor exists", () => {
    const n1 = createTestNode("n1", 0, 0);
    expect(navigateTerminalFocus("non-existent", [n1], "right")).toBeNull();
    expect(navigateTerminalFocus("n1", [n1], "left")).toBeNull();
  });
});
