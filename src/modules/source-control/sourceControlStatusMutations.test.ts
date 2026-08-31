import { describe, expect, it } from "vitest";
import type { GitStatusSnapshot } from "@/modules/ai/lib/native";
import {
  optimisticDiscard,
  optimisticStage,
  optimisticUnstage,
} from "./sourceControlStatusMutations";

const snapshot: GitStatusSnapshot = {
  repoRoot: "/repo",
  branch: "main",
  upstream: "origin/main",
  ahead: 0,
  behind: 0,
  isDetached: false,
  truncated: false,
  changedFiles: [
    {
      path: "renamed.ts",
      originalPath: "old.ts",
      indexStatus: "R",
      worktreeStatus: " ",
      staged: true,
      unstaged: false,
      untracked: false,
      statusLabel: "Renamed",
    },
    {
      path: "modified.ts",
      originalPath: null,
      indexStatus: " ",
      worktreeStatus: "M",
      staged: false,
      unstaged: true,
      untracked: false,
      statusLabel: "Modified",
    },
  ],
};

describe("sourceControlStatusMutations", () => {
  it("moves worktree changes to the index optimistically", () => {
    expect(optimisticStage(snapshot, new Set(["modified.ts"])).changedFiles[1]).toMatchObject({
      indexStatus: "M",
      worktreeStatus: " ",
      staged: true,
      unstaged: false,
    });
  });

  it("turns an unstaged rename into deleted and untracked entries", () => {
    expect(optimisticUnstage(snapshot, new Set(["renamed.ts"])).changedFiles).toMatchObject([
      {
        path: "old.ts",
        indexStatus: " ",
        worktreeStatus: "D",
        staged: false,
        unstaged: true,
      },
      {
        path: "renamed.ts",
        indexStatus: " ",
        worktreeStatus: "?",
        staged: false,
        unstaged: true,
        untracked: true,
      },
      { path: "modified.ts", staged: false, unstaged: true },
    ]);
  });

  it("drops discarded unstaged files but preserves their staged counterpart", () => {
    const status = {
      ...snapshot,
      changedFiles: [
        { ...snapshot.changedFiles[0], worktreeStatus: "M", unstaged: true },
        snapshot.changedFiles[1],
      ],
    };

    expect(optimisticDiscard(status, new Set(["renamed.ts", "modified.ts"])).changedFiles).toEqual([
      expect.objectContaining({
        path: "renamed.ts",
        staged: true,
        unstaged: false,
        worktreeStatus: " ",
      }),
    ]);
  });
});
