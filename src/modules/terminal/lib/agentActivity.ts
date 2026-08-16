import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSyncExternalStore } from "react";

type Listener = () => void;

let respondingLeaves = new Set<number>();
let completedLeaves = new Set<number>();
let agentCommands = new Map<number, string>();
// pty id -> leaf id. Rust `cmdspace:agent-signal` events carry the PTY id;
// the app keys sessions by leaf id, so this registry bridges the two.
let ptyLeafMap = new Map<number, number>();
const listeners = new Set<Listener>();

export type AgentSignalKind =
  | "started"
  | "working"
  | "attention"
  | "finished"
  | "exited";

export type AgentSignal = {
  id: number;
  kind: AgentSignalKind;
  agent: string | null;
};

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

function getAgentCommandsSnapshot(): ReadonlyMap<number, string> {
  return agentCommands;
}

function getCompletedSnapshot(): ReadonlySet<number> {
  return completedLeaves;
}

export function setAgentResponseActivity(
  leafId: number,
  responding: boolean,
): void {
  const hasLeaf = respondingLeaves.has(leafId);
  if (hasLeaf === responding) return;

  const next = new Set(respondingLeaves);
  const completed = new Set(completedLeaves);
  if (responding) {
    next.add(leafId);
    completed.delete(leafId);
  } else {
    next.delete(leafId);
    completed.add(leafId);
  }
  respondingLeaves = next;
  completedLeaves = completed;
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

export function setPtyLeaf(ptyId: number, leafId: number): void {
  ptyLeafMap.set(ptyId, leafId);
}

export function clearPtyLeaf(ptyId: number): void {
  ptyLeafMap.delete(ptyId);
}

export function getLeafForPty(ptyId: number): number | undefined {
  return ptyLeafMap.get(ptyId);
}

/** Apply a Rust `cmdspace:agent-signal` to the store, if the pty maps to a
 *  live leaf. `started`/`working`/`attention` flip responding on; the
 *  existing 900 ms output heuristic remains as the fallback for agents the
 *  detector doesn't know, and `finished`/`exited` clear it. */
export function applyAgentSignal(signal: AgentSignal): void {
  const leafId = ptyLeafMap.get(signal.id);
  if (leafId === undefined) return;
  switch (signal.kind) {
    case "started":
      if (signal.agent) setAgentCliCommand(leafId, signal.agent);
      setAgentResponseActivity(leafId, true);
      break;
    case "working":
    case "attention":
      setAgentResponseActivity(leafId, true);
      break;
    case "finished":
      setAgentResponseActivity(leafId, false);
      break;
    case "exited":
      setAgentResponseActivity(leafId, false);
      setAgentCliCommand(leafId, undefined);
      clearPtyLeaf(signal.id);
      break;
  }
}

let unlistenAgentSignal: UnlistenFn | null = null;

/** Subscribe to `cmdspace:agent-signal` once. Idempotent. */
export function ensureAgentActivityListener(): void {
  if (unlistenAgentSignal) return;
  void listen<AgentSignal>("cmdspace:agent-signal", (event) => {
    applyAgentSignal(event.payload);
  }).then((unlisten) => {
    unlistenAgentSignal = unlisten;
  });
}

export function useAgentResponseLeaves(): ReadonlySet<number> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useAgentCompletedLeaves(): ReadonlySet<number> {
  return useSyncExternalStore(subscribe, getCompletedSnapshot, getCompletedSnapshot);
}

export function useAgentCliCommand(leafId?: number): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (leafId === undefined ? undefined : agentCommands.get(leafId)),
    () => undefined,
  );
}

export function useAgentCliCommands(): ReadonlyMap<number, string> {
  return useSyncExternalStore(
    subscribe,
    getAgentCommandsSnapshot,
    getAgentCommandsSnapshot,
  );
}
