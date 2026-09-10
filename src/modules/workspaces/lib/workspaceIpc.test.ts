import { describe, expect, it } from "vitest";
import {
  listWorkspaces,
  parseIpcError,
  saveWorkspace,
  toWorkspaceDto,
  type WorkspaceDtoInput,
} from "./workspaceIpc";

const workspace: WorkspaceDtoInput & {
  tabId: number | null;
  canvasTabId: number | null;
} = {
  id: "workspace-1",
  name: "Workspace",
  count: 2,
  accentColor: "#10B981",
  workingFolder: "/tmp/workspace",
  createdAt: 1,
  updatedAt: 2,
  displayOrder: 0,
  paneLayout: null,
  workspaceMode: "standard",
  pinned: true,
  tabId: 4,
  canvasTabId: null,
};

describe("workspace IPC facade", () => {
  it("projects persistence fields and drops transient tab ownership", () => {
    expect(toWorkspaceDto(workspace)).toEqual({
      id: "workspace-1",
      name: "Workspace",
      count: 2,
      accentColor: "#10B981",
      workingFolder: "/tmp/workspace",
      createdAt: 1,
      updatedAt: 2,
      displayOrder: 0,
      paneLayout: null,
      workspaceMode: "standard",
      pinned: true,
    });
  });

  it("uses the stable command payload for list and save", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
    const invoke = async <T>(command: string, args?: Record<string, unknown>) => {
      calls.push({ command, args });
      return [] as T;
    };

    await listWorkspaces(invoke);
    await saveWorkspace(invoke, workspace);

    expect(calls).toEqual([
      { command: "db_list_workspaces", args: undefined },
      {
        command: "db_save_workspace",
        args: { workspace: toWorkspaceDto(workspace) },
      },
    ]);
  });

  it("normalizes structured and legacy native errors", () => {
    expect(
      parseIpcError({ code: "DB_MIGRATION_FAILED", message: "migration failed" }),
    ).toEqual({
      code: "DB_MIGRATION_FAILED",
      message: "migration failed",
    });
    expect(parseIpcError(new Error("offline"))).toEqual({
      code: "UNKNOWN",
      message: "offline",
    });
    expect(parseIpcError("offline")).toEqual({
      code: "UNKNOWN",
      message: "offline",
    });
  });
});
