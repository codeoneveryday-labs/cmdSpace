import { describe, expect, it } from "vitest";
import { isolatedAgentCommand, worktreeSlug } from "./agentWorktree";

describe("agent worktree isolation", () => {
  it("builds a managed worktree command without deleting anything", () => {
    const command = isolatedAgentCommand("codex", "Fix auth", "session-abc");
    expect(command).toContain('branch_name="cmdspace/session-abc-fix-auth"');
    expect(command).toContain('git worktree add -b "$branch_name" "$worktree_path" HEAD');
    expect(command).not.toContain("worktree remove");
    expect(command.endsWith("; codex")).toBe(true);
  });

  it("normalizes unsafe labels", () => {
    expect(worktreeSlug(" ../../Feature: Login ", "task")).toBe("feature-login");
  });
});
