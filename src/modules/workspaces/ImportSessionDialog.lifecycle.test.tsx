import { describe, expect, it, vi } from "vitest";

type StateHook = {
  kind: "state";
  setter: (next: unknown | ((current: unknown) => unknown)) => void;
  value: unknown;
};

type MemoHook = {
  deps: readonly unknown[];
  kind: "memo";
  value: unknown;
};

type EffectHook = {
  cleanup?: () => void;
  create: () => void | (() => void);
  deps: readonly unknown[];
  kind: "effect";
};

type HookSlot = StateHook | MemoHook | EffectHook;

const hookRuntime = vi.hoisted(() => {
  let cursor = 0;
  let hooks: HookSlot[] = [];
  let hasUncommittedRender = false;
  let pendingPassiveEffectIndexes: number[] = [];

  const dependenciesChanged = (
    previous: readonly unknown[] | undefined,
    next: readonly unknown[] | undefined,
  ) =>
    !previous ||
    !next ||
    previous.length !== next.length ||
    previous.some((value, index) => !Object.is(value, next[index]));

  function nextHook(): [number, HookSlot | undefined] {
    const index = cursor;
    cursor += 1;
    return [index, hooks[index]];
  }

  function useState<T>(initial: T | (() => T)) {
    const [index, slot] = nextHook();
    if (!slot) {
      const state: StateHook = {
        kind: "state",
        value: typeof initial === "function" ? (initial as () => T)() : initial,
        setter: (next) => {
          const currentState = hooks[index];
          if (!currentState || currentState.kind !== "state") {
            throw new Error(`Expected state hook at ${index}`);
          }
          const current = currentState.value as T;
          currentState.value =
            typeof next === "function"
              ? (next as (current: T) => T)(current)
              : next;
        },
      };
      hooks[index] = state;
    }

    const state = hooks[index]!;
    if (state.kind !== "state") {
      throw new Error(`Expected state hook at ${index}`);
    }

    return [
      state.value as T,
      state.setter as (next: T | ((current: T) => T)) => void,
    ] as const;
  }

  function useMemo<T>(factory: () => T, deps: readonly unknown[]) {
    const [index, slot] = nextHook();
    if (
      !slot ||
      slot.kind !== "memo" ||
      dependenciesChanged(slot.deps, deps)
    ) {
      hooks[index] = { deps, kind: "memo", value: factory() };
    }
    return (hooks[index]! as MemoHook).value as T;
  }

  function useCallback<T extends (...args: never[]) => unknown>(
    callback: T,
    deps: readonly unknown[],
  ) {
    return useMemo(() => callback, deps);
  }

  function useEffect(
    effect: () => void | (() => void),
    deps: readonly unknown[],
  ) {
    const [index, slot] = nextHook();
    if (
      !slot ||
      slot.kind !== "effect" ||
      dependenciesChanged(slot.deps, deps)
    ) {
      hooks[index] = {
        cleanup: slot?.kind === "effect" ? slot.cleanup : undefined,
        create: effect,
        deps,
        kind: "effect",
      };
      if (!pendingPassiveEffectIndexes.includes(index)) {
        pendingPassiveEffectIndexes.push(index);
      }
    }
  }

  return {
    beginRender() {
      if (hasUncommittedRender) throw new Error("Previous render was not committed");
      cursor = 0;
      hasUncommittedRender = true;
    },
    commit() {
      if (!hasUncommittedRender) throw new Error("No render to commit");
      hasUncommittedRender = false;
    },
    flushPassiveEffects() {
      if (hasUncommittedRender) throw new Error("Cannot flush effects before commit");

      const indexes = pendingPassiveEffectIndexes;
      pendingPassiveEffectIndexes = [];
      for (const index of indexes) {
        const effect = hooks[index];
        if (!effect || effect.kind !== "effect") continue;
        effect.cleanup?.();
        const cleanup = effect.create();
        effect.cleanup = typeof cleanup === "function" ? cleanup : undefined;
      }
    },
    stateAt<T>(index: number) {
      const state = hooks[index];
      if (!state || state.kind !== "state") {
        throw new Error(`Expected state hook at ${index}`);
      }
      return state.value as T;
    },
    reset() {
      for (const hook of hooks) {
        if (hook.kind === "effect") hook.cleanup?.();
      }
      cursor = 0;
      hooks = [];
      hasUncommittedRender = false;
      pendingPassiveEffectIndexes = [];
    },
    useCallback,
    useEffect,
    useMemo,
    useState,
  };
});

const preferences = vi.hoisted(() => ({
  cliAgentIds: ["claude", "codex"],
  disabledCliAgentIds: [] as string[],
}));

vi.mock("react", () => ({
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useMemo: hookRuntime.useMemo,
  useState: hookRuntime.useState,
}));

vi.mock("@/components/ui/select", () => ({
  Select: "test-select",
  SelectContent: "test-select-content",
  SelectItem: "test-select-item",
  SelectTrigger: "test-select-trigger",
  SelectValue: "test-select-value",
}));

vi.mock("@/modules/settings/preferences", () => ({
  usePreferencesStore: (
    selector: (state: {
      cliAgentIds: string[];
      disabledCliAgentIds: string[];
    }) => unknown,
  ) => selector(preferences),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

import { ImportSessionDialog } from "./ImportSessionDialog";

type ElementNode = {
  props?: Record<string, unknown>;
  type?: unknown;
};

function findByType(node: unknown, type: unknown): ElementNode | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findByType(child, type);
      if (match) return match;
    }
    return undefined;
  }
  if (!node || typeof node !== "object") return undefined;

  const element = node as ElementNode;
  if (element.type === type) return element;
  return findByType(element.props?.children, type);
}

function renderDialog() {
  hookRuntime.beginRender();
  const tree = ImportSessionDialog({
    open: true,
    onOpenChange: () => undefined,
    workspaceName: "Workspace",
    workspaceCwd: "/workspace",
    onImport: async () => true,
  });
  hookRuntime.commit();
  return tree;
}

function selectedProvider(tree: unknown) {
  const select = findByType(tree, "test-select");
  expect(select).toBeDefined();
  return select!.props!;
}

describe("ImportSessionDialog provider lifecycle", () => {
  it("normalizes a disabled provider only after the derived UI fallback renders", () => {
    hookRuntime.reset();
    preferences.disabledCliAgentIds = [];

    const initialProvider = selectedProvider(renderDialog());
    expect(initialProvider.value).toBe("all");
    hookRuntime.flushPassiveEffects();

    (initialProvider.onValueChange as (value: string) => void)("claude");
    expect(selectedProvider(renderDialog()).value).toBe("claude");
    hookRuntime.flushPassiveEffects();

    preferences.disabledCliAgentIds = ["claude"];
    const disabledProvider = selectedProvider(renderDialog());
    expect(disabledProvider.value).toBe("all");
    expect(hookRuntime.stateAt<"all" | "claude">(2)).toBe("claude");

    hookRuntime.flushPassiveEffects();
    expect(hookRuntime.stateAt<"all" | "claude">(2)).toBe("all");
    expect(selectedProvider(renderDialog()).value).toBe("all");

    preferences.disabledCliAgentIds = [];
    expect(selectedProvider(renderDialog()).value).toBe("all");
    expect(hookRuntime.stateAt<"all" | "claude">(2)).toBe("all");
    hookRuntime.flushPassiveEffects();
    expect(hookRuntime.stateAt<"all" | "claude">(2)).toBe("all");
  });
});
