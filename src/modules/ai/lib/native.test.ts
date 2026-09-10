import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { native, parseReadResult } from "./native";

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
