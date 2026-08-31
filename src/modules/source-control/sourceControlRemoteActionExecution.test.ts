import { describe, expect, it, vi } from "vitest";
import { performSourceControlRemoteAction } from "./sourceControlRemoteActionExecution";

const repo = { repoRoot: "/repo", branch: "main", upstream: "origin/main", isDetached: false };

describe("performSourceControlRemoteAction", () => {
  it("performs a contextual pull and refreshes after success", async () => {
    const calls: string[] = [];
    const result = await performSourceControlRemoteAction({
      repo,
      status: {
        repoRoot: "/repo",
        branch: "main",
        upstream: "origin/main",
        isDetached: false,
        truncated: false,
        ahead: 0,
        behind: 2,
        changedFiles: [],
      },
      mode: "contextual",
      fetch: async () => { calls.push("fetch"); },
      pull: async () => { calls.push("pull"); },
      push: async () => { calls.push("push"); },
      refresh: async () => { calls.push("refresh"); },
    });

    expect(result).toEqual({ ok: true, action: "pull" });
    expect(calls).toEqual(["pull", "refresh"]);
  });

  it("blocks a diverged branch without invoking remote operations", async () => {
    const remote = vi.fn(async () => undefined);
    const result = await performSourceControlRemoteAction({
      repo,
      status: {
        repoRoot: "/repo",
        branch: "main",
        upstream: "origin/main",
        isDetached: false,
        truncated: false,
        ahead: 1,
        behind: 1,
        changedFiles: [],
      },
      mode: "contextual",
      fetch: remote,
      pull: remote,
      push: remote,
      refresh: remote,
    });

    expect(result).toEqual({ ok: false, action: null, blocked: "diverged" });
    expect(remote).not.toHaveBeenCalled();
  });

  it("refreshes after a failed remote operation and returns a normalized error", async () => {
    const refresh = vi.fn(async () => undefined);
    const result = await performSourceControlRemoteAction({
      repo,
      status: {
        repoRoot: "/repo",
        branch: "main",
        upstream: "origin/main",
        isDetached: false,
        truncated: false,
        ahead: 1,
        behind: 0,
        changedFiles: [],
      },
      mode: "contextual",
      fetch: async () => undefined,
      pull: async () => undefined,
      push: async () => {
        throw new Error("push rejected");
      },
      refresh,
    });

    expect(result).toEqual({
      ok: false,
      action: "push",
      error: "push rejected",
    });
    expect(refresh).toHaveBeenCalledOnce();
  });
});
