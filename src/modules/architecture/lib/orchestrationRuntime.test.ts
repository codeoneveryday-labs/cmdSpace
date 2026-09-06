import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    onmessage = () => undefined;
  },
  invoke: mocks.invoke,
}));

import { createOrchestrationRuntime } from "./orchestrationRuntime";
import { createOrchestrationDraft } from "./orchestrationManifest";

describe("orchestrationRuntime", () => {
  it("creates a Canvas-only run with the workspace and draft manifest", async () => {
    mocks.invoke.mockResolvedValue({ id: "run-1" });
    const runtime = createOrchestrationRuntime(() => undefined);
    const manifest = createOrchestrationDraft("Build it", "codex");

    await runtime.createRun("workspace-1", "/repo", "run-1", manifest);

    expect(mocks.invoke).toHaveBeenCalledWith("orchestration_create_run", {
      workspaceId: "workspace-1",
      cwd: "/repo",
      runId: "run-1",
      manifest,
    });
  });

  it("sends hive mail and routes the outbox", async () => {
    mocks.invoke.mockResolvedValue({ delivered: [], skipped: [] });
    const runtime = createOrchestrationRuntime(() => undefined);

    await runtime.sendMail({
      runId: "run-1",
      from: "builder",
      to: "orchestrator",
      act: "request",
      subject: "Need review",
      body: "Please review the worktree.",
    });

    expect(mocks.invoke).toHaveBeenCalledWith("orchestration_mail_send", {
      runId: "run-1",
      from: "builder",
      to: "orchestrator",
      act: "request",
      subject: "Need review",
      body: "Please review the worktree.",
      conversation: null,
      inReplyTo: null,
    });
    await runtime.routeMail("run-1");
    expect(mocks.invoke).toHaveBeenCalledWith("orchestration_mail_route", {
      runId: "run-1",
    });
  });

  it("sends a threaded reply and checks unread", async () => {
    mocks.invoke.mockResolvedValue({ id: "m-2" });
    const runtime = createOrchestrationRuntime(() => undefined);

    await runtime.sendMail({
      runId: "run-1",
      from: "orchestrator",
      to: "builder",
      act: "inform",
      subject: "Re: Need review",
      body: "Approved.",
      conversation: "conv-7",
      inReplyTo: "m-1",
    });

    expect(mocks.invoke).toHaveBeenCalledWith("orchestration_mail_send", {
      runId: "run-1",
      from: "orchestrator",
      to: "builder",
      act: "inform",
      subject: "Re: Need review",
      body: "Approved.",
      conversation: "conv-7",
      inReplyTo: "m-1",
    });

    mocks.invoke.mockResolvedValue({ unreadIds: ["m-2"], total: 1, lastProcessed: "m-1" });
    await runtime.loadUnread("run-1", "builder");
    expect(mocks.invoke).toHaveBeenCalledWith("orchestration_mail_unread", {
      runId: "run-1",
      agentId: "builder",
    });
  });

  it("loads and acknowledges an agent inbox", async () => {
    mocks.invoke.mockResolvedValue([]);
    const runtime = createOrchestrationRuntime(() => undefined);

    await runtime.loadInbox("run-1", "orchestrator");
    expect(mocks.invoke).toHaveBeenCalledWith("orchestration_mail_inbox", {
      runId: "run-1",
      agentId: "orchestrator",
    });
    await runtime.ackMail("run-1", "orchestrator", "m-1");
    expect(mocks.invoke).toHaveBeenCalledWith("orchestration_mail_ack", {
      runId: "run-1",
      agentId: "orchestrator",
      messageId: "m-1",
    });
  });

  it("reindexes and searches team memories", async () => {
    mocks.invoke.mockResolvedValue({ indexed: 2, skippedUnchanged: 1 });
    const runtime = createOrchestrationRuntime(() => undefined);

    await runtime.reindexMemories("run-1");
    expect(mocks.invoke).toHaveBeenCalledWith("orchestration_memory_reindex", {
      runId: "run-1",
    });

    mocks.invoke.mockResolvedValue([]);
    await runtime.searchMemories("run-1", "flaky test");
    expect(mocks.invoke).toHaveBeenCalledWith("orchestration_memory_search", {
      runId: "run-1",
      query: "flaky test",
      limit: 8,
    });
  });

  it("lists and claims ephemeral spawn requests", async () => {
    mocks.invoke.mockResolvedValue([]);
    const runtime = createOrchestrationRuntime(() => undefined);

    await runtime.listSpawnRequests("run-1");
    expect(mocks.invoke).toHaveBeenCalledWith("orchestration_spawn_list", {
      runId: "run-1",
    });
    await runtime.claimSpawnRequest("run-1", "helper-1");
    expect(mocks.invoke).toHaveBeenCalledWith("orchestration_spawn_claim", {
      runId: "run-1",
      id: "helper-1",
    });
  });
});
