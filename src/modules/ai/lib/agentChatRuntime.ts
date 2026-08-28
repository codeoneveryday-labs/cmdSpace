import { currentWorkspaceEnv } from "@/modules/workspace";
import { Channel, invoke } from "@tauri-apps/api/core";
import type { AgentChatEvent } from "./agentChatTimeline";

export type AgentChatModelOption = {
  id: string;
  label: string;
  description?: string | null;
};

export type AgentModelCache = {
  provider: string;
  models: AgentChatModelOption[];
  updatedAt: number;
};

export function loadAgentModelCache(provider: string) {
  return invoke<AgentModelCache | null>("db_load_agent_model_cache", { provider });
}

export function saveAgentModelCache(cache: AgentModelCache) {
  return invoke<void>("db_save_agent_model_cache", { cache });
}

export type AgentChatConfig = {
  chatId: string;
  provider: string;
  model: string | null;
  effort: string | null;
  permissionMode: string | null;
  fastMode: boolean;
  planMode: boolean;
};

export function loadAgentChatConfig(chatId: string) {
  return invoke<AgentChatConfig | null>("db_load_agent_chat_config", { chatId });
}

export function saveAgentChatConfig(config: AgentChatConfig) {
  return invoke<void>("db_save_agent_chat_config", { config });
}

const modelDiscoveryCache = new Map<string, Promise<AgentChatModelOption[]>>();
const slashOptionsCache = new Map<string, Promise<AgentChatModelOption[]>>();

export function listAgentChatModels(provider: string, cwd: string) {
  const key = `${provider}:${cwd}`;
  const cached = modelDiscoveryCache.get(key);
  if (cached) return cached;
  const request = invoke<AgentChatModelOption[]>("agent_chat_list_models", {
    provider,
    cwd,
    workspace: currentWorkspaceEnv(),
  });
  modelDiscoveryCache.set(key, request);
  void request.catch(() => {
    if (modelDiscoveryCache.get(key) === request) modelDiscoveryCache.delete(key);
  });
  return request;
}

export function listAgentChatSlashOptions(provider: string, cwd: string, command: string) {
  const key = `${provider}:${cwd}:${command}`;
  const cached = slashOptionsCache.get(key);
  if (cached) return cached;
  const request = invoke<AgentChatModelOption[]>("agent_chat_list_slash_options", {
    provider,
    cwd,
    command,
    workspace: currentWorkspaceEnv(),
  });
  slashOptionsCache.set(key, request);
  void request.catch(() => {
    if (slashOptionsCache.get(key) === request) slashOptionsCache.delete(key);
  });
  return request;
}

export type AgentChatRuntimeClient = ReturnType<typeof createAgentChatRuntime>;

export function createAgentChatRuntime(onEvent: (event: AgentChatEvent) => void) {
  const channel = new Channel<AgentChatEvent>();
  channel.onmessage = onEvent;
  return {
    start(input: {
      provider: string;
      cwd: string;
      prompt: string;
      model?: string;
      nativeSessionId: string | null;
    }) {
      return invoke<{ sessionId: string }>("agent_chat_start", {
        ...input,
        workspace: currentWorkspaceEnv(),
        onEvent: channel,
      });
    },
    send(sessionId: string, prompt: string, model?: string) {
      return invoke<void>("agent_chat_send", { sessionId, prompt, model, onEvent: channel });
    },
    cancel(sessionId: string) {
      return invoke<void>("agent_chat_cancel", { sessionId });
    },
    close(sessionId: string) {
      return invoke<void>("agent_chat_close", { sessionId });
    },
    loadHistory(provider: string, cwd: string, nativeSessionId: string) {
      return invoke<AgentChatEvent[]>("agent_chat_load_history", {
        provider,
        cwd,
        nativeSessionId,
        workspace: currentWorkspaceEnv(),
      });
    },
  };
}
