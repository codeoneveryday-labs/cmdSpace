import { describe, expect, it, vi } from "vitest";
import { serializeRendererSlot } from "./rendererSerialization";

function slotWith(
  serialize: () => string,
  cols = 80,
  rows = 24,
) {
  return {
    term: { cols, rows } as never,
    serializeAddon: { serialize } as never,
  };
}

describe("rendererSerialization", () => {
  it("preserves the snapshot metadata and requested scrollback", () => {
    const serialize = vi.fn(() => "snapshot");

    expect(serializeRendererSlot(slotWith(serialize, 120, 40), 500, true)).toEqual({
      snapshot: "snapshot",
      cols: 120,
      rows: 40,
      altScreen: true,
    });
    expect(serialize).toHaveBeenCalledWith({ scrollback: 500 });
  });

  it("falls back to a null snapshot when serialization fails", () => {
    const serialize = vi.fn(() => {
      throw new Error("serialize failed");
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      expect(serializeRendererSlot(slotWith(serialize), 100, false).snapshot).toBeNull();
      expect(warning).toHaveBeenCalledWith(
        "[cmdspace] serialize failed:",
        expect.any(Error),
      );
    } finally {
      warning.mockRestore();
    }
  });
});
