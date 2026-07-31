import { emit, listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import {
  BUILTIN_AGENTS,
  DEFAULT_AGENT_ID,
  loadAgents,
  newAgentId,
  saveActiveAgentId,
  saveCustomAgents,
  type Agent,
} from "../lib/agents";

const CHANGED_EVENT = "cmdspace://ai-agents-changed";

type AgentsState = {
  hydrated: boolean;
  customAgents: Agent[];
  activeId: string;
  /** All agents, builtin first. */
  all: () => Agent[];
  hydrate: () => Promise<void>;
  setActiveId: (id: string) => void;
  upsert: (agent: Agent) => void;
  remove: (id: string) => void;
};

let initialized = false;

function broadcast(): void {
  void emit(CHANGED_EVENT);
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  hydrated: false,
  customAgents: [],
  activeId: DEFAULT_AGENT_ID,
  all: () => [...BUILTIN_AGENTS, ...get().customAgents],
  hydrate: async () => {
    if (initialized) return;
    initialized = true;
    const { custom, activeId } = await loadAgents();
    const available = new Set([
      ...BUILTIN_AGENTS.map((agent) => agent.id),
      ...custom.map((agent) => agent.id),
    ]);
    const nextActiveId = available.has(activeId) ? activeId : DEFAULT_AGENT_ID;
    set({ customAgents: custom, activeId: nextActiveId, hydrated: true });
    if (nextActiveId !== activeId) void saveActiveAgentId(nextActiveId);

    void listen(CHANGED_EVENT, async () => {
      const fresh = await loadAgents();
      const available = new Set([
        ...BUILTIN_AGENTS.map((agent) => agent.id),
        ...fresh.custom.map((agent) => agent.id),
      ]);
      set({
        customAgents: fresh.custom,
        activeId: available.has(fresh.activeId)
          ? fresh.activeId
          : DEFAULT_AGENT_ID,
      });
    });
  },
  setActiveId: (id) => {
    set({ activeId: id });
    void saveActiveAgentId(id).then(broadcast);
  },
  upsert: (agent) => {
    if (agent.builtIn) return;
    const list = get().customAgents;
    const idx = list.findIndex((a) => a.id === agent.id);
    const next =
      idx === -1 ? [...list, agent] : list.map((a) => (a.id === agent.id ? agent : a));
    set({ customAgents: next });
    void saveCustomAgents(next).then(broadcast);
  },
  remove: (id) => {
    const list = get().customAgents.filter((a) => a.id !== id);
    set({ customAgents: list });
    let active = get().activeId;
    if (active === id) {
      active = DEFAULT_AGENT_ID;
      set({ activeId: active });
      void saveActiveAgentId(active);
    }
    void saveCustomAgents(list).then(broadcast);
  },
}));

export { newAgentId };
