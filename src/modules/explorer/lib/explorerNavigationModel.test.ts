import { describe, expect, it } from "vitest";
import { resolveExplorerNavigation } from "./explorerNavigationModel";

const paths = ["/repo/src", "/repo/src/App.tsx", "/repo/README.md"];
const entries = new Map([
  [paths[0], { path: paths[0], isDir: true, isExpanded: true }],
  [paths[1], { path: paths[1], isDir: false, isExpanded: false }],
  [paths[2], { path: paths[2], isDir: false, isExpanded: false }],
]);

describe("explorerNavigationModel", () => {
  it("moves, opens files, and toggles directories", () => {
    expect(resolveExplorerNavigation("ArrowDown", false, -1, paths, entries, "/repo", 0)).toEqual({ type: "move", index: 0, extend: false });
    expect(resolveExplorerNavigation("ArrowRight", false, 0, paths, entries, "/repo", 0)).toEqual({ type: "move", index: 1, extend: false });
    expect(resolveExplorerNavigation("Enter", false, 1, paths, entries, "/repo", 0)).toEqual({ type: "open", path: "/repo/src/App.tsx" });
  });

  it("handles clear/delete and parent navigation", () => {
    expect(resolveExplorerNavigation("Escape", false, 1, paths, entries, "/repo", 0)).toEqual({ type: "clear" });
    expect(resolveExplorerNavigation("Delete", false, 1, paths, entries, "/repo", 1)).toEqual({ type: "delete" });
    expect(resolveExplorerNavigation("ArrowLeft", false, 1, paths, entries, "/repo", 0)).toEqual({ type: "move", index: 0, extend: false });
  });
});
