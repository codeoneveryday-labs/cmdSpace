import { describe, expect, it } from "vitest";
import {
  FULLY_SUPPORTED_AGENT_CHAT_PROVIDER_IDS,
  resolveAgentChatProviders,
  resolveAgentChatWorkspaceAgents,
} from "./agentChatProviders";

describe("resolveAgentChatWorkspaceAgents", () => {
  it("keeps only enabled configured providers with full agent-chat support", () => {
    const agents = resolveAgentChatWorkspaceAgents({
      configuredIds: ["codex", "gemini", "opencode", "herdr", "cmd"],
      disabledIds: [],
    });

    expect(agents.map(({ id }) => id)).toEqual(["codex", "cmd"]);
  });

  it("returns no provider when the only fully supported configured CLI is disabled", () => {
    const agents = resolveAgentChatWorkspaceAgents({
      configuredIds: ["codex", "gemini", "opencode", "cmd"],
      disabledIds: ["codex", "cmd"],
    });

    expect(agents).toEqual([]);
  });
});

describe("FULLY_SUPPORTED_AGENT_CHAT_PROVIDER_IDS", () => {
  it("lists Codex, Command Code, and Claude as fully supported agent-chat providers", () => {
    expect(FULLY_SUPPORTED_AGENT_CHAT_PROVIDER_IDS).toEqual(["codex", "cmd", "claude"]);
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

  it("excludes installed providers that are not fully supported", () => {
    const providers = resolveAgentChatProviders({
      configuredIds: ["omp"],
      disabledIds: [],
      installedIds: ["omp"],
    });
    expect(providers).toEqual([]);
  });

  it("includes Command Code when it is enabled and installed", () => {
    const providers = resolveAgentChatProviders({
      configuredIds: ["cmd"],
      disabledIds: [],
      installedIds: ["cmd"],
    });

    expect(providers.map(({ id, chatTransport }) => ({ id, chatTransport }))).toEqual([
      { id: "cmd", chatTransport: "command-code-json" },
    ]);
  });
});
