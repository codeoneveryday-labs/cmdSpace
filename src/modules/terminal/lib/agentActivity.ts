import { useSyncExternalStore } from "react";

type Listener = () => void;

let respondingLeaves = new Set<number>();
let agentCommands = new Map<number, string>();
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ReadonlySet<number> {
  return respondingLeaves;
}

export function setAgentResponseActivity(leafId: number, responding: boolean): void {
  const hasLeaf = respondingLeaves.has(leafId);
  if (hasLeaf === responding) return;

  const next = new Set(respondingLeaves);
  if (responding) next.add(leafId);
  else next.delete(leafId);
  respondingLeaves = next;
  notify();
}

export function setAgentCliCommand(leafId: number, command?: string): void {
  if (agentCommands.get(leafId) === command) return;
  const next = new Map(agentCommands);
  if (command) next.set(leafId, command);
  else next.delete(leafId);
  agentCommands = next;
  notify();
}

export function useAgentResponseLeaves(): ReadonlySet<number> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useAgentCliCommand(leafId?: number): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (leafId === undefined ? undefined : agentCommands.get(leafId)),
    () => undefined,
  );
}
