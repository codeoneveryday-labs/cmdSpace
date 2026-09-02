import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import { createWorkspaceAction } from "./workspaceCreationAction";

describe("createWorkspaceAction", () => {
  it("persists every Standard-workspace launch command before mounting terminals", async () => {
    const commands = [
      "codex --dangerously-bypass-approvals-and-sandbox",
      "codex --dangerously-bypass-approvals-and-sandbox",
      "gemini",
      "opencode --auto",
      "herdr",
      "cmd --dangerously-skip-permissions",
      "cmd --dangerously-skip-permissions",
      "cmd --dangerously-skip-permissions",
    ];
    const events: string[] = [];
    const persisted = vi.fn(async (pane) => {
      events.push(`persist:${pane.paneIndex}`);
    });
    const newWorkspaceTab = vi.fn(() => {
      events.push("mount");
      return 99;
    });
    const onStandardWorkspaceReady = vi.fn();
    mocks.invoke.mockResolvedValue(undefined);

    await createWorkspaceAction(
      {
        terminalCount: commands.length,
        workingFolder: "/repo",
        initialCommands: commands,
        workspaceMode: "standard",
        inheritedCwd: undefined,
        nextWorkspaceName: () => "workspace-01",
        tabs: [],
        newAgentChatTab: vi.fn(() => 0),
        newWorkspaceTab,
        newArchitectureTab: vi.fn(() => 0),
        closeTab: vi.fn(),
        setActiveId: vi.fn(),
        onStandardWorkspaceReady,
        closeSetup: vi.fn(),
        alert: vi.fn(),
      },
      {
        workspaces: [],
        setWorkspaces: vi.fn(),
        persistPaneRecord: persisted,
        saveRecentWorkspace: vi.fn(),
      },
    );

    expect(persisted).toHaveBeenCalledTimes(commands.length);
    expect(persisted.mock.calls.map(([pane]) => pane.lastCommand)).toEqual(commands);
    expect(events).toEqual([
      "persist:0",
      "persist:1",
      "persist:2",
      "persist:3",
      "persist:4",
      "persist:5",
      "persist:6",
      "persist:7",
      "mount",
    ]);
    const [workspaceId, workingFolder, launchedPanes] =
      onStandardWorkspaceReady.mock.calls[0] ?? [];
    expect(workspaceId).toEqual(expect.any(String));
    expect(workingFolder).toBe("/repo");
    expect(launchedPanes).toEqual(
      commands.map((lastCommand, paneIndex) => ({
        paneIndex,
        autoLaunch: true,
        lastCommand,
        workingFolder: "/repo",
      })),
    );
  });

  it("marks Canvas launch panes after they are persisted", async () => {
    const events: string[] = [];
    const onCanvasWorkspaceReady = vi.fn();
    const persisted = vi.fn(async (pane) => {
      events.push(`persist:${pane.paneIndex}`);
    });
    const newArchitectureTab = vi.fn(() => {
      events.push("mount");
      return 42;
    });
    mocks.invoke.mockResolvedValue(undefined);

    await createWorkspaceAction(
      {
        terminalCount: 2,
        workingFolder: "/repo",
        initialCommands: ["codex", "cmd --dangerously-skip-permissions"],
        workspaceMode: "canvas",
        inheritedCwd: undefined,
        nextWorkspaceName: () => "workspace-01",
        tabs: [],
        newAgentChatTab: vi.fn(() => 0),
        newWorkspaceTab: vi.fn(),
        newArchitectureTab,
        closeTab: vi.fn(),
        setActiveId: vi.fn(),
        onCanvasWorkspaceReady,
        closeSetup: vi.fn(),
        alert: vi.fn(),
      },
      {
        workspaces: [],
        setWorkspaces: vi.fn(),
        persistPaneRecord: persisted,
        saveRecentWorkspace: vi.fn(),
      },
    );

    expect(newArchitectureTab).toHaveBeenCalledOnce();
    expect(events).toEqual(["persist:0", "persist:1", "mount"]);
    const [workspaceId, workingFolder, launchedPanes] =
      onCanvasWorkspaceReady.mock.calls[0] ?? [];
    expect(workspaceId).toEqual(expect.any(String));
    expect(workingFolder).toBe("/repo");
    expect(launchedPanes).toEqual([
      { paneIndex: 0, workingFolder: "/repo", lastCommand: "codex", autoLaunch: true },
      {
        paneIndex: 1,
        workingFolder: "/repo",
        lastCommand: "cmd --dangerously-skip-permissions",
        autoLaunch: true,
      },
    ]);
  });
});
