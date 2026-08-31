import { describe, expect, it } from "vitest";
import type { GitStatusSnapshot } from "@/modules/ai/lib/native";
import { buildSourceControlEntries } from "./sourceControlEntriesModel";

const status: GitStatusSnapshot = {
  repoRoot: "/repo",
  branch: "main",
  upstream: "origin/main",
  ahead: 0,
  behind: 0,
  isDetached: false,
  truncated: false,
  changedFiles: [
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
    {
      path: "README.md",
      originalPath: null,
      indexStatus: " ",
      worktreeStatus: "?",
      staged: false,
      unstaged: true,
      untracked: true,
      statusLabel: "Untracked",
    },
  ],
};

describe("sourceControlEntriesModel", () => {
  it("derives grouped entries and one merged checkbox row per file", () => {
    const entries = buildSourceControlEntries(status);

    expect(entries.stagedEntries).toMatchObject([
      { key: "+:src/app.ts", statusCode: "M" },
    ]);
    expect(entries.unstagedEntries).toMatchObject([
      { key: "-:src/app.ts", statusCode: "M" },
      { key: "-:README.md", statusCode: "U" },
    ]);
    expect(entries.fileEntries).toMatchObject([
      { path: "src/app.ts", checkState: "indeterminate", staged: true, unstaged: true },
      { path: "README.md", checkState: "unchecked", statusCode: "U" },
    ]);
    expect(entries.headerCheckState).toBe("indeterminate");
    expect(entries.allClean).toBe(false);
  });

  it("returns an unchecked, clean view for an absent snapshot", () => {
    expect(buildSourceControlEntries(null)).toMatchObject({
      stagedEntries: [],
      unstagedEntries: [],
      fileEntries: [],
      headerCheckState: "unchecked",
      allClean: true,
    });
  });
});
