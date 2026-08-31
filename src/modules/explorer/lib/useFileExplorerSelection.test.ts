import { describe, expect, it } from "vitest";

describe("useFileExplorerSelection behavior", () => {
  it("extends a selection range and clears selection state on root change", async () => {
    const module = await import("./useFileExplorerSelection");

    expect(typeof module.selectFileExplorerPath).toBe("function");
    expect(typeof module.resetFileExplorerSelectionState).toBe("function");

    const rangeSelection = module.selectFileExplorerPath(
      {
        selectedPaths: ["/repo/src"],
        selectionAnchor: "/repo/src",
        focusedPath: "/repo/src",
      },
      ["/repo/src", "/repo/src/App.tsx", "/repo/README.md"],
      "/repo/src/App.tsx",
      true,
    );

    expect(rangeSelection).toEqual({
      selectedPaths: ["/repo/src", "/repo/src/App.tsx"],
      selectionAnchor: "/repo/src",
      focusedPath: "/repo/src/App.tsx",
    });
    expect(module.resetFileExplorerSelectionState()).toEqual({
      selectedPaths: [],
      selectionAnchor: null,
      focusedPath: null,
    });
  });
});
