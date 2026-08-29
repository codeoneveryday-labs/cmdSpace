import { describe, expect, it } from "vitest";
import {
  countDiffLines,
  countTextLines,
  createAgentEditBaseline,
  filesChangedByAgent,
} from "./agentChatEdits";

describe("agent chat edit summaries", () => {
  it("counts patch additions and removals without diff headers", () => {
    expect(countDiffLines("@@ -1 +1 @@\n-old\n+new\n")).toEqual({
      added: 1,
      removed: 1,
    });
  });

  it("keeps only files that were clean before the agent turn", () => {
    const baseline = createAgentEditBaseline({
      repo: { repoRoot: "/repo", branch: "main", upstream: null, isDetached: false },
      status: {
        repoRoot: "/repo",
        branch: "main",
        upstream: null,
        ahead: 0,
        behind: 0,
        isDetached: false,
        truncated: false,
        changedFiles: [{ path: "existing.ts", originalPath: null, indexStatus: " ", worktreeStatus: "M", staged: false, unstaged: true, untracked: false, statusLabel: "modified" }],
      },
    });
    const changed = filesChangedByAgent(baseline, {
      repo: { repoRoot: "/repo", branch: "main", upstream: null, isDetached: false },
      status: {
        repoRoot: "/repo",
        branch: "main",
        upstream: null,
        ahead: 0,
        behind: 0,
        isDetached: false,
        truncated: false,
        changedFiles: [
          { path: "existing.ts", originalPath: null, indexStatus: " ", worktreeStatus: "M", staged: false, unstaged: true, untracked: false, statusLabel: "modified" },
          { path: "new.ts", originalPath: null, indexStatus: "?", worktreeStatus: "?", staged: false, unstaged: true, untracked: true, statusLabel: "untracked" },
        ],
      },
    });
    expect(changed.map((file) => file.path)).toEqual(["new.ts"]);
  });

  it("counts a new text file as added lines", () => {
    expect(countTextLines("one\ntwo\nthree")).toBe(3);
  });
});
