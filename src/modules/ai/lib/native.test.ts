import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { native, parseGitStatusSnapshot, parseReadResult } from "./native";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("native filesystem IPC", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("keeps the filesystem success discriminant unchanged", async () => {
    mockedInvoke.mockResolvedValueOnce({
      kind: "text",
      content: "hello",
      size: 5,
    });

    await expect(native.readFile("/tmp/note.txt")).resolves.toEqual({
      kind: "text",
      content: "hello",
      size: 5,
    });
    expect(mockedInvoke).toHaveBeenCalledWith("fs_read_file", {
      path: "/tmp/note.txt",
      workspace: { kind: "local" },
    });
  });

  it("normalizes a structured filesystem error without losing Error semantics", async () => {
    mockedInvoke.mockRejectedValueOnce({
      code: "FS_NOT_FOUND",
      message: "filesystem stat: path was not found",
    });

    await expect(native.readFile("/tmp/missing.txt")).rejects.toMatchObject({
      code: "FS_NOT_FOUND",
      message: "filesystem stat: path was not found",
      name: "TauriIpcError",
    });
  });

  it("rejects an invalid filesystem response at the IPC boundary", () => {
    expect(() => parseReadResult({ kind: "text", content: 42, size: 2 })).toThrowError(
      expect.objectContaining({
        code: "FS_RESPONSE_INVALID",
        message: "filesystem response is invalid",
      }),
    );
  });
});

describe("native Git IPC", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("keeps the Git status success shape unchanged", async () => {
    const status = {
      repoRoot: "/repo",
      branch: "main",
      upstream: "origin/main",
      ahead: 1,
      behind: 0,
      isDetached: false,
      truncated: false,
      changedFiles: [
        {
          path: "src/main.rs",
          originalPath: null,
          indexStatus: "M",
          worktreeStatus: " ",
          staged: true,
          unstaged: false,
          untracked: false,
          statusLabel: "Modified",
        },
      ],
    };
    mockedInvoke.mockResolvedValueOnce(status);

    await expect(native.gitStatus("/repo")).resolves.toEqual(status);
    expect(mockedInvoke).toHaveBeenCalledWith("git_status", {
      repoRoot: "/repo",
      workspace: { kind: "local" },
    });
  });

  it("normalizes structured Git errors without losing Error semantics", async () => {
    mockedInvoke.mockRejectedValueOnce({
      code: "GIT_PATH_NOT_AUTHORIZED",
      message: "Git path is not authorized",
    });

    await expect(native.gitStatus("/private/repo")).rejects.toMatchObject({
      code: "GIT_PATH_NOT_AUTHORIZED",
      message: "Git path is not authorized",
      name: "TauriIpcError",
    });
  });

  it("rejects an invalid Git status response at the IPC boundary", () => {
    expect(() =>
      parseGitStatusSnapshot({
        repoRoot: "/repo",
        branch: "main",
        upstream: null,
        ahead: 0,
        behind: 0,
        isDetached: false,
        truncated: false,
        changedFiles: [{ path: 42 }],
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "GIT_RESPONSE_INVALID",
        message: "Git status response is invalid",
      }),
    );
  });
});
