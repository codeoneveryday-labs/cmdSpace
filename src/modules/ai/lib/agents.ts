import { LazyStore } from "@tauri-apps/plugin-store";

export type AgentIconId =
  | "coder"
  | "architect"
  | "reviewer"
  | "security"
  | "designer"
  | "spark";

export type Agent = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  icon: AgentIconId;
  builtIn: boolean;
};

export const DEFAULT_AGENT_ID = "builtin:prompt-engineer";

export const BUILTIN_AGENTS: readonly Agent[] = [
  {
    id: "builtin:prompt-engineer",
    name: "Prompt Engineer",
    description: "Turns rough ideas into clear, implementation-ready prompts.",
    icon: "spark",
    builtIn: true,
    instructions: `You are a prompt engineer whose job is to prepare coding-agent briefs, not to implement software yourself.
- When the user asks to create, write, or improve a prompt for building, implementing, or fixing something, do not create a markdown file, do not edit project files, do not write the implementation, and do not use suggest_command.
- Rewrite the user's short request into one task-specific English brief using exactly these headings: Task, Context, Requirements, Constraints, Validation.
- Preserve the user's intent and add only useful implementation context. Make requirements observable, state assumptions instead of inventing repository facts, and keep the result roughly 180–320 words.
- Call dispatch_to_terminals immediately with the refined English prompt. By default send it only to the focused terminal pane; do not broadcast identical prompts to every pane unless the user explicitly asks.
- After dispatching, reply with a short confirmation only. Do not create a markdown file, do not open an AI diff, and do not return a long prompt-writing essay.`,
  },
] as const;

const STORE_PATH = "cmdspace-ai-agents.json";
const KEY_CUSTOM = "customAgents";
const KEY_ACTIVE = "activeAgentId";

const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: 200 });

export type LoadedAgents = {
  custom: Agent[];
  activeId: string;
};

export async function loadAgents(): Promise<LoadedAgents> {
  // One IPC roundtrip via entries() instead of two sequential get()s.
  const entries = await store.entries();
  let custom: Agent[] | undefined;
  let activeId: string | undefined;
  for (const [k, v] of entries) {
    if (k === KEY_CUSTOM) custom = v as Agent[];
    else if (k === KEY_ACTIVE) activeId = v as string;
  }
  const customAgents = custom ?? [];
  const activeIsAvailable =
    BUILTIN_AGENTS.some((agent) => agent.id === activeId) ||
    customAgents.some((agent) => agent.id === activeId);
  return {
    custom: customAgents,
    activeId: activeIsAvailable ? activeId! : DEFAULT_AGENT_ID,
  };
}

export async function saveCustomAgents(custom: Agent[]): Promise<void> {
  await store.set(KEY_CUSTOM, custom);
  await store.save();
}

export async function saveActiveAgentId(id: string): Promise<void> {
  await store.set(KEY_ACTIVE, id);
  await store.save();
}

export function newAgentId(): string {
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function findAgent(
  agents: readonly Agent[],
  id: string | null | undefined,
): Agent {
  if (!id) return agents.find((a) => a.id === DEFAULT_AGENT_ID) ?? BUILTIN_AGENTS[0];
  return agents.find((a) => a.id === id) ?? agents.find((a) => a.id === DEFAULT_AGENT_ID) ?? BUILTIN_AGENTS[0];
}
