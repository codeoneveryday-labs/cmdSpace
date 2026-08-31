import { describe, expect, it, vi } from "vitest";

import {
  createFileTreeMutations,
  type FileTreeMutationPort,
} from "./fileTreeMutations";

function createHarness() {
  const events: string[] = [];
  const invoke = vi.fn<FileTreeMutationPort["invoke"]>(
    async (command: string, payload: Record<string, unknown>) => {
      events.push(`${command}:${JSON.stringify(payload)}`);
      if (command === "fs_delete") {
        return { path: payload.path, token: `token:${payload.path}` };
      }
      if (command === "fs_import_paths") return ["/repo/dest/imported.ts"];
      if (command === "fs_import_clipboard_file") return "/repo/dest/pasted.ts";
      return undefined;
    },
  );
  const refresh = vi.fn(async (path: string) => {
    events.push(`refresh:${path}`);
  });
  const onPathRenamed = vi.fn((from: string, to: string) => {
    events.push(`renamed:${from}->${to}`);
  });
  const onPathDeleted = vi.fn((path: string) => events.push(`deleted:${path}`));
  const onDeleteCommitted = vi.fn(() => events.push("delete-committed"));
  const reportError = vi.fn();
  const mutations = createFileTreeMutations({
    invoke,
    refresh,
    workspace: () => ({ kind: "local" }),
    onPathRenamed,
    onPathDeleted,
    onDeleteCommitted,
    reportError,
  });

  return {
    mutations,
    invoke,
    refresh,
    onPathRenamed,
    onPathDeleted,
    onDeleteCommitted,
    reportError,
    events,
  };
}

describe("file tree mutations", () => {
  it("creates and renames before refreshing the affected parent", async () => {
    const harness = createHarness();

    await harness.mutations.create("/repo", "dir", "notes");
    await harness.mutations.rename("/repo/notes", "archive");

    expect(harness.events).toEqual([
      'fs_create_dir:{"path":"/repo/notes","workspace":{"kind":"local"}}',
      "refresh:/repo",
      'fs_rename:{"from":"/repo/notes","to":"/repo/archive","workspace":{"kind":"local"}}',
      "renamed:/repo/notes->/repo/archive",
      "refresh:/repo",
    ]);
  });

  it("deletes only top-level selections and commits their undo records before refresh", async () => {
    const harness = createHarness();

    await harness.mutations.deletePaths(["/repo/a", "/repo/a/child", "/repo/b"]);

    expect(harness.onPathDeleted).toHaveBeenCalledWith("/repo/a");
    expect(harness.onPathDeleted).toHaveBeenCalledWith("/repo/b");
    expect(harness.onDeleteCommitted).toHaveBeenCalledWith([
      { path: "/repo/a", token: "token:/repo/a" },
      { path: "/repo/b", token: "token:/repo/b" },
    ]);
    expect(harness.events.indexOf("delete-committed")).toBeLessThan(
      harness.events.indexOf("refresh:/repo"),
    );
  });

  it("moves each top-level source sequentially then refreshes destination and origins", async () => {
    const harness = createHarness();

    await harness.mutations.movePaths(["/repo/a", "/repo/a/child", "/repo/b"], "/repo/dest");

    expect(harness.invoke.mock.calls.map(([command]) => command)).toEqual([
      "fs_rename",
      "fs_rename",
    ]);
    expect(harness.onPathRenamed).toHaveBeenNthCalledWith(
      1,
      "/repo/a",
      "/repo/dest/a",
    );
    expect(harness.onPathRenamed).toHaveBeenNthCalledWith(
      2,
      "/repo/b",
      "/repo/dest/b",
    );
    expect(harness.refresh).toHaveBeenCalledWith("/repo/dest");
    expect(harness.refresh).toHaveBeenCalledWith("/repo");
  });

  it("rejects a self-descendant move without invoking the native bridge", async () => {
    const harness = createHarness();

    await expect(
      harness.mutations.movePaths(["/repo/a"], "/repo/a/child"),
    ).rejects.toThrow("A folder cannot be moved into itself.");
    expect(harness.invoke).not.toHaveBeenCalled();
  });

  it("restores parents before descendants and refreshes successful parents", async () => {
    const harness = createHarness();

    await harness.mutations.restorePaths([
      { path: "/repo/a/child", token: "child" },
      { path: "/repo/a", token: "parent" },
    ]);

    expect(harness.invoke.mock.calls.map(([, payload]) => payload.path)).toEqual([
      "/repo/a",
      "/repo/a/child",
    ]);
    expect(harness.refresh).toHaveBeenCalledWith("/repo");
    expect(harness.refresh).toHaveBeenCalledWith("/repo/a");
  });
});
