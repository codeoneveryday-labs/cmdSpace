import { describe, expect, it, vi } from "vitest";
import {
  buildActiveTerminalItems,
  buildWorkspaceItems,
  countActiveCodingAgents,
} from "./workspaceItemsModel";
import type { WorkspaceRecord } from "./useWorkspaceController";

const workspace = (overrides: Partial<WorkspaceRecord> = {}): WorkspaceRecord =>
  ({
    id: "workspace-1",
    name: "Workspace",
    count: 1,
    accentColor: "#0088ff",
    workingFolder: "/tmp/project",
    createdAt: 1,
    updatedAt: 1,
    displayOrder: 0,
    paneLayout: null,
    tabId: null,
    canvasTabId: null,
    agentProvider: null,
    agentSessionId: null,
    ...overrides,
  }) as WorkspaceRecord;

const baseInput = (): Parameters<typeof buildWorkspaceItems>[0] => ({
  workspaces: [workspace()],
  tabs: [],
  activeId: 1,
  activeWorkspaceId: "workspace-1",
  activeWorkspaceTerminals: [],
  persistedWorkspacePanes: {},
  agentCommands: new Map(),
  respondingLeaves: new Set<number>(),
  requestedLeaves: new Set<number>(),
  blockedLeaves: new Set<number>(),
  completedLeaves: new Set<number>(),
  activeCanvasTerminalIds: new Map(),
  closePaneByLeaf: vi.fn(),
  closeCanvasTerminal: vi.fn(),
  closeAgentTab: vi.fn(),
});

describe("workspaceItemsModel", () => {
  it("counts tracked coding agents in the active terminal tab", () => {
    const tab = {
      id: 1,
      kind: "terminal",
      title: "shell",
      cwd: "/repo",
      activeLeafId: 7,
      paneTree: { kind: "leaf", id: 7, cwd: "/repo", lastCommand: "codex" },
    } as never;

    expect(countActiveCodingAgents(tab, new Map([[7, "codex"]]))).toBe(1);
    expect(countActiveCodingAgents(undefined, new Map())).toBe(0);
  });

  it("builds active terminal rows with live agent state", () => {
    const closePaneByLeaf = vi.fn();
    const rows = buildActiveTerminalItems({
      tab: {
        id: 1,
        kind: "terminal",
        title: "shell",
        cwd: "/repo",
        activeLeafId: 7,
        paneTree: { kind: "leaf", id: 7, cwd: "/repo", lastCommand: "codex", autoLaunch: true },
      } as never,
      activeLeafId: 7,
      agentCommands: new Map([[7, "codex"]]),
      respondingLeaves: new Set([7]),
      requestedLeaves: new Set([7]),
      blockedLeaves: new Set(),
      completedLeaves: new Set(),
      closePaneByLeaf,
    });

    expect(rows[0]).toMatchObject({ label: "codex", active: true, state: "working" });
    rows[0].onClose?.();
    expect(closePaneByLeaf).toHaveBeenCalledWith(7);
  });

  it("uses live active terminals and derives aggregate agent state", () => {
    const input = baseInput();
    input.activeWorkspaceTerminals = [
      {
        leafId: 7,
        label: "codex",
        active: true,
        responding: false,
        completed: false,
        state: "blocked",
      },
    ];

    const [item] = buildWorkspaceItems(input);

    expect(item.count).toBe(1);
    expect(item.terminals).toBe(input.activeWorkspaceTerminals);
    expect(item.state).toBe("blocked");
  });

  it("keeps an agent workspace empty when its agent tabs are not loaded", () => {
    const items = buildWorkspaceItems({
      ...baseInput(),
      workspaces: [workspace({ workspaceMode: "agent" })],
    });

    expect(items[0]).toMatchObject({ count: 0, terminals: [] });
  });
});
