import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import {
  getAgentUsageStatuses,
  listTerminalSubdirectories,
  traceTerminalInput,
} from "./terminal-native";

describe("typed terminal native bridge", () => {
  beforeEach(() => mocks.invoke.mockReset());

  it("serializes terminal input tracing", async () => {
    mocks.invoke.mockResolvedValue(undefined);
    await traceTerminalInput("xterm-ondata", "ls\r");
    expect(mocks.invoke).toHaveBeenCalledWith("pty_trace_input", {
      source: "xterm-ondata",
      data: "ls\r",
    });
  });

  it("serializes agent usage and directory requests", async () => {
    mocks.invoke.mockResolvedValue([]);
    await getAgentUsageStatuses("/repo", "codex", "thread-1");
    await getAgentUsageStatuses("/repo", "cmd", null, null, 1_700_000_000_000);
    await listTerminalSubdirectories("/repo", true);
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "agent_usage_statuses", {
      cwd: "/repo",
      provider: "codex",
      nativeSessionId: "thread-1",
      sessionTitleHint: undefined,
      sessionStartedAtMs: undefined,
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "agent_usage_statuses", {
      cwd: "/repo",
      provider: "cmd",
      nativeSessionId: null,
      sessionTitleHint: null,
      sessionStartedAtMs: 1_700_000_000_000,
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(3, "list_subdirs", {
      path: "/repo",
      showHidden: true,
      workspace: expect.any(Object),
    });
  });
});
