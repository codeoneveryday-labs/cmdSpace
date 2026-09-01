import { describe, expect, it } from "vitest";

import { getRemoteFolderView } from "./remoteFolderPickerModel";

const state = {
  current: "/workspace",
  parent: "/",
  folders: [
    { name: "src", path: "/workspace/src" },
    { name: "Scripts", path: "/workspace/Scripts" },
  ],
  files: [
    { name: "README.md", path: "/workspace/README.md", parent: "/workspace" },
    { name: "package.json", path: "/workspace/package.json", parent: "/workspace" },
  ],
};

describe("remote folder picker view model", () => {
  it("filters folders and files case-insensitively after trimming query space", () => {
    expect(getRemoteFolderView(state, "  scr ")).toMatchObject({
      normalizedSearch: "scr",
      folders: [{ name: "Scripts" }],
      files: [],
      isEmpty: false,
    });
  });

  it("keeps every entry for an empty search", () => {
    expect(getRemoteFolderView(state, "")).toMatchObject({
      normalizedSearch: "",
      folders: state.folders,
      files: state.files,
      isEmpty: false,
    });
  });

  it("reports an empty view for unmatched search or missing folder state", () => {
    expect(getRemoteFolderView(state, "missing")).toMatchObject({
      isEmpty: true,
      normalizedSearch: "missing",
    });
    expect(getRemoteFolderView(null, "src")).toMatchObject({
      isEmpty: true,
      folders: [],
      files: [],
    });
  });
});
