import { describe, expect, it } from "vitest";
import type { Tab } from "./tabTypes";
import {
  openGitCommitFileDiffState,
  openGitDiffState,
  openGitHistoryState,
} from "./gitTabTransitions";

const base = [{ id: 1, kind: "markdown", title: "A", path: "/a.md" }] as Tab[];

describe("gitTabTransitions", () => {
  it("dedupes and updates git diff tabs", () => {
    const input = { id: 2, path: "src/a.ts", repoRoot: "/repo", mode: "-" as const, originalPath: null, title: "A diff" };
    const first = openGitDiffState(base, input);
    const second = openGitDiffState(first.tabs, { ...input, id: 99, title: "Updated" });
    expect(second.targetId).toBe(2);
    expect(second.tabs).toHaveLength(2);
    expect(second.tabs[1]).toMatchObject({ title: "Updated" });
  });

  it("dedupes history and commit-file diff tabs by their identity", () => {
    const history = openGitHistoryState(base, { id: 2, repoRoot: "/repo", branch: "main" });
    expect(openGitHistoryState(history.tabs, { id: 9, repoRoot: "/repo", branch: "dev" }).targetId).toBe(2);
    const commit = openGitCommitFileDiffState(base, { id: 3, repoRoot: "/repo", sha: "abc", shortSha: "abc", subject: "Fix", path: "src/a.ts", originalPath: null });
    expect(openGitCommitFileDiffState(commit.tabs, { id: 9, repoRoot: "/repo", sha: "abc", shortSha: "abc", subject: "Updated", path: "src/a.ts", originalPath: "src/old.ts" }).targetId).toBe(3);
  });
});
