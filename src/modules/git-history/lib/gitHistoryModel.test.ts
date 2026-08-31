import { describe, expect, it } from "vitest";
import { filterGitCommits, mergeGitCommits } from "./gitHistoryModel";
import type { GitLogEntry } from "@/modules/ai/lib/native";

const commit = (sha: string, subject: string, author = "Ada"): GitLogEntry =>
  ({ sha, shortSha: sha.slice(0, 7), subject, author, authorEmail: `${author.toLowerCase()}@example.com` } as GitLogEntry);

describe("gitHistoryModel", () => {
  it("filters by subject, author, email, or short SHA", () => {
    const commits = [commit("abcdef123", "Fix parser"), commit("123456789", "Add tests", "Grace")];

    expect(filterGitCommits(commits, "parser")).toHaveLength(1);
    expect(filterGitCommits(commits, "grace")).toHaveLength(1);
    expect(filterGitCommits(commits, "ada@example")).toHaveLength(1);
    expect(filterGitCommits(commits, "abcdef")).toHaveLength(1);
  });

  it("merges pagination results without duplicate SHAs", () => {
    const result = mergeGitCommits(
      [commit("one", "First")],
      [commit("one", "First again"), commit("two", "Second")],
    );

    expect(result.map(({ sha }) => sha)).toEqual(["one", "two"]);
  });
});
