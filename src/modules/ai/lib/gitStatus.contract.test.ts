import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { native } from "./native";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

const status = {
  repoRoot: "/repo",
  branch: "main",
  upstream: null,
  ahead: 0,
  behind: 0,
  isDetached: false,
  truncated: false,
  changedFiles: [],
};

describe("git_status IPC contract", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("keeps the registered command name, request keys, and response DTO stable", async () => {
    mockedInvoke.mockResolvedValueOnce(status);

    await expect(native.gitStatus("/repo")).resolves.toEqual(status);
    expect(mockedInvoke).toHaveBeenCalledWith("git_status", {
      repoRoot: "/repo",
      workspace: { kind: "local" },
    });
  });

  it("preserves the stable native error code instead of error prose", async () => {
    mockedInvoke.mockRejectedValueOnce({
      code: "GIT_TIMED_OUT",
      message: "Git operation timed out",
    });

    await expect(native.gitStatus("/repo")).rejects.toMatchObject({
      code: "GIT_TIMED_OUT",
      name: "TauriIpcError",
    });
  });
});
