import { describe, expect, it } from "vitest";
import {
  createGitHistoryGraphCache,
  updateGitHistoryGraphCache,
} from "./useGitHistoryGraph";

const commit = (sha: string, parents: string[] = []) => ({
  sha,
  shortSha: sha.slice(0, 7),
  subject: sha,
  authorName: "author",
  authorEmail: "author@example.com",
  author: "author <author@example.com>",
  authorDate: "2026-08-31T00:00:00Z",
  timestampSecs: 0,
  filesChanged: 0,
  insertions: 0,
  deletions: 0,
  parents,
});

describe("useGitHistoryGraph", () => {
  it("appends only new commits while preserving existing graph rows", () => {
    const cache = createGitHistoryGraphCache();
    const first = updateGitHistoryGraphCache(cache, [commit("a"), commit("b")]);
    const firstRow = first.graphByCommit.get("a");
    const second = updateGitHistoryGraphCache(cache, [
      commit("a"),
      commit("b"),
      commit("c"),
    ]);

    expect(second.graphByCommit.get("a")).toBe(firstRow);
    expect(second.graphByCommit.has("c")).toBe(true);
    expect(cache.len).toBe(3);
  });

  it("rebuilds when the newest commit changes and clears on empty input", () => {
    const cache = createGitHistoryGraphCache();
    updateGitHistoryGraphCache(cache, [commit("old")]);
    const rebuilt = updateGitHistoryGraphCache(cache, [commit("new")]);
    expect(rebuilt.graphByCommit.has("old")).toBe(false);
    expect(rebuilt.graphByCommit.has("new")).toBe(true);
    expect(updateGitHistoryGraphCache(cache, []).maxLaneCount).toBe(1);
    expect(cache.len).toBe(0);
  });
});
