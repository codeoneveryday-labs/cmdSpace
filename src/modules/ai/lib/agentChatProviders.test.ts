import { describe, expect, it } from "vitest";
import {
  resolveAgentChatProviders,
  resolveAgentChatWorkspaceAgents,
} from "./agentChatProviders";

describe("resolveAgentChatWorkspaceAgents", () => {
  it("keeps every enabled configured agent except Herdr", () => {
    const agents = resolveAgentChatWorkspaceAgents({
      configuredIds: ["codex", "gemini", "opencode", "herdr", "cmd"],
      disabledIds: [],
    });

    expect(agents.map(({ id }) => id)).toEqual([
      "codex",
      "gemini",
      "opencode",
      "cmd",
    ]);
  });

  it("honors disabled settings without falling back to Codex", () => {
    const agents = resolveAgentChatWorkspaceAgents({
      configuredIds: ["codex", "gemini", "opencode", "cmd"],
      disabledIds: ["codex"],
    });

    expect(agents.map(({ id }) => id)).toEqual(["gemini", "opencode", "cmd"]);
  });
});

describe("resolveAgentChatProviders", () => {
  it("returns installed chat-capable agents enabled in Settings in Settings order", () => {
    const providers = resolveAgentChatProviders({
      configuredIds: ["claude", "opencode", "aider", "codex", "claude", "gemini"],
      disabledIds: [],
      installedIds: ["aider", "codex", "claude", "opencode"],
    });

    expect(providers.map(({ id, chatTransport }) => ({ id, chatTransport }))).toEqual([
      { id: "claude", chatTransport: "claude-json" },
      { id: "codex", chatTransport: "codex-app-server" },
    ]);
  });

  it("returns no providers when Settings has no enabled installed chat agent", () => {
    expect(
      resolveAgentChatProviders({
        configuredIds: ["aider", "codex"],
        disabledIds: ["codex"],
        installedIds: ["aider", "codex"],
      }),
    ).toEqual([]);
  });

  it("includes omp when its RPC CLI is enabled and installed", () => {
    const providers = resolveAgentChatProviders({
      configuredIds: ["omp"],
      disabledIds: [],
      installedIds: ["omp"],
    });
    expect(providers.map(({ id, chatTransport }) => ({ id, chatTransport }))).toEqual([
      { id: "omp", chatTransport: "omp-rpc" },
    ]);
  });
});
