import { describe, expect, it } from "vitest";
import type { GitChangedFile } from "@/modules/ai/lib/native";
import {
  reconcileDiffSelection,
  sameDiffSelection,
} from "./sourceControlSelectionModel";

const changedFiles: GitChangedFile[] = [
  {
    path: "src/app.ts",
    originalPath: null,
    indexStatus: "M",
    worktreeStatus: "M",
    staged: true,
    unstaged: true,
    untracked: false,
    statusLabel: "Modified",
  },
];

describe("sourceControlSelectionModel", () => {
  it("recognizes an exact diff selection", () => {
    expect(
      sameDiffSelection(
        { path: "src/app.ts", mode: "+" },
        { path: "src/app.ts", mode: "+" },
      ),
    ).toBe(true);
  });

  it("moves a selection to the remaining diff mode before clearing it", () => {
    expect(
      reconcileDiffSelection({ path: "src/app.ts", mode: "+" }, [
        { ...changedFiles[0], staged: false, indexStatus: " " },
      ]),
    ).toEqual({
      selection: { path: "src/app.ts", mode: "-" },
      transition: "moved-group",
    });
    expect(
      reconcileDiffSelection({ path: "src/app.ts", mode: "+" }, []),
    ).toEqual({ selection: null, transition: "reset" });
  });
});
