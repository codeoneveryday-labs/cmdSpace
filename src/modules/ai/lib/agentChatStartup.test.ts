import { describe, expect, it, vi } from "vitest";
import { createAgentChatStartup } from "./agentChatStartup";

describe("agent chat startup", () => {
  it("does not contact the native runtime until the first prompt is submitted", () => {
    const runtime = {
      attach: vi.fn(),
      start: vi.fn(),
    };

    createAgentChatStartup({
      runtime,
      chatId: "chat-1",
      provider: "codex",
      cwd: "/workspace",
      nativeSessionId: null,
    });

    expect(runtime.attach).not.toHaveBeenCalled();
    expect(runtime.start).not.toHaveBeenCalled();
  });

  it("uses one cold start for concurrent first-prompt admission", async () => {
    const runtime = {
      attach: vi.fn().mockRejectedValue(new Error("not resident")),
      start: vi.fn().mockResolvedValue({ sessionId: "runtime-1", attachmentToken: "token-1" }),
    };
    const startup = createAgentChatStartup({
      runtime,
      chatId: "chat-1",
      provider: "codex",
      cwd: "/workspace",
      nativeSessionId: "thread-1",
    });

    const [first, second] = await Promise.all([
      startup.admitFirstPrompt("inspect the repository", "gpt-5.4"),
      startup.admitFirstPrompt("ignored duplicate", "gpt-5.4"),
    ]);

    expect(first).toEqual({ sessionId: "runtime-1", attachmentToken: "token-1", started: true });
    expect(second).toEqual(first);
    expect(runtime.attach).toHaveBeenCalledTimes(1);
    expect(runtime.start).toHaveBeenCalledTimes(1);
    expect(runtime.start).toHaveBeenCalledWith({
      provider: "codex",
      cwd: "/workspace",
      prompt: "inspect the repository",
      chatId: "chat-1",
      model: "gpt-5.4",
      nativeSessionId: "thread-1",
    });
  });

  it("reuses a resident runtime without starting another provider", async () => {
    const runtime = {
      attach: vi.fn().mockResolvedValue({ sessionId: "runtime-1", attachmentToken: "token-1" }),
      start: vi.fn(),
    };
    const startup = createAgentChatStartup({
      runtime,
      chatId: "chat-1",
      provider: "codex",
      cwd: "/workspace",
      nativeSessionId: null,
    });

    await expect(startup.admitFirstPrompt("continue")).resolves.toEqual({
      sessionId: "runtime-1",
      attachmentToken: "token-1",
      started: false,
    });
    expect(runtime.start).not.toHaveBeenCalled();
  });

  it("lets a background resident attach satisfy the first prompt", async () => {
    const runtime = {
      attach: vi.fn().mockResolvedValue({ sessionId: "runtime-1", attachmentToken: "token-1" }),
      start: vi.fn(),
    };
    const startup = createAgentChatStartup({
      runtime,
      chatId: "chat-1",
      provider: "codex",
      cwd: "/workspace",
      nativeSessionId: null,
    });

    await expect(startup.attachResident()).resolves.toEqual({
      sessionId: "runtime-1",
      attachmentToken: "token-1",
      started: false,
    });
    await expect(startup.admitFirstPrompt("continue")).resolves.toEqual({
      sessionId: "runtime-1",
      attachmentToken: "token-1",
      started: false,
    });
    expect(runtime.attach).toHaveBeenCalledTimes(1);
    expect(runtime.start).not.toHaveBeenCalled();
  });

  it("starts the first prompt immediately after a background attach misses", async () => {
    const runtime = {
      attach: vi.fn().mockRejectedValue(new Error("not resident")),
      start: vi.fn().mockResolvedValue({ sessionId: "runtime-1", attachmentToken: "token-1" }),
    };
    const startup = createAgentChatStartup({
      runtime,
      chatId: "chat-1",
      provider: "codex",
      cwd: "/workspace",
      nativeSessionId: null,
    });

    await expect(startup.attachResident()).rejects.toThrow("not resident");
    await expect(startup.admitFirstPrompt("inspect")).resolves.toEqual({
      sessionId: "runtime-1",
      attachmentToken: "token-1",
      started: true,
    });
    expect(runtime.attach).toHaveBeenCalledTimes(1);
    expect(runtime.start).toHaveBeenCalledTimes(1);
  });

  it("retries a cold start after the previous start failed", async () => {
    const runtime = {
      attach: vi.fn().mockRejectedValue(new Error("not resident")),
      start: vi
        .fn()
        .mockRejectedValueOnce(new Error("CLI unavailable"))
        .mockResolvedValueOnce({ sessionId: "runtime-2", attachmentToken: "token-2" }),
    };
    const startup = createAgentChatStartup({
      runtime,
      chatId: "chat-1",
      provider: "codex",
      cwd: "/workspace",
      nativeSessionId: null,
    });

    await expect(startup.admitFirstPrompt("first try")).rejects.toThrow("CLI unavailable");
    await expect(startup.admitFirstPrompt("retry")).resolves.toEqual({
      sessionId: "runtime-2",
      attachmentToken: "token-2",
      started: true,
    });
    expect(runtime.start).toHaveBeenCalledTimes(2);
  });

  it("re-admits the current prompt after a cached resident runtime disappears", async () => {
    const runtime = {
      attach: vi
        .fn()
        .mockResolvedValueOnce({ sessionId: "runtime-stale", attachmentToken: "token-stale" })
        .mockRejectedValueOnce(new Error("No resident agent chat runtime for 'chat-1'")),
      start: vi.fn().mockResolvedValue({ sessionId: "runtime-restarted", attachmentToken: "token-restarted" }),
    };
    const startup = createAgentChatStartup({
      runtime,
      chatId: "chat-1",
      provider: "codex",
      cwd: "/workspace",
      nativeSessionId: "thread-1",
    });

    await expect(startup.admitFirstPrompt("stale prompt")).resolves.toEqual({
      sessionId: "runtime-stale",
      attachmentToken: "token-stale",
      started: false,
    });
    await expect(startup.recoverFirstPrompt("retry this exact prompt", "gpt-5.4")).resolves.toEqual({
      sessionId: "runtime-restarted",
      attachmentToken: "token-restarted",
      started: true,
    });

    expect(runtime.attach).toHaveBeenCalledTimes(2);
    expect(runtime.start).toHaveBeenCalledTimes(1);
    expect(runtime.start).toHaveBeenCalledWith({
      provider: "codex",
      cwd: "/workspace",
      prompt: "retry this exact prompt",
      chatId: "chat-1",
      model: "gpt-5.4",
      nativeSessionId: "thread-1",
    });
  });
});
