# Terminal Agent Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an enabled-agent dropdown to each terminal header that replaces the CLI in the same pane while preserving cwd and workspace persistence.

**Architecture:** A focused `TerminalAgentSwitcher` component owns Settings-driven menu presentation and command resolution. The selected command travels through `PaneTreeView` and `TerminalStack` to `App`, where pane launch metadata is updated, persisted, and passed to a new same-leaf session replacement helper.

**Tech Stack:** React 19, TypeScript, Zustand preferences, Radix/shadcn dropdown primitives, Tauri PTY bridge, Vitest.

---

### Task 1: Model same-leaf launch replacement

**Files:**
- Modify: `src/modules/terminal/lib/panes.ts`
- Modify: `src/modules/tabs/lib/useTabs.ts`
- Create: `src/modules/terminal/lib/panes.test.ts`

- [ ] **Step 1: Write the failing pane metadata tests**

Add cases that prove an agent command enables auto-launch and selecting Terminal removes the saved launch command:

```ts
import { setLeafLaunchCommand } from "./panes";

it("sets an agent command as the leaf launch plan", () => {
  expect(setLeafLaunchCommand({ kind: "leaf", id: 7 }, 7, "codex")).toEqual({
    kind: "leaf",
    id: 7,
    lastCommand: "codex",
    autoLaunch: true,
  });
});

it("clears the launch plan when switching to Terminal", () => {
  expect(
    setLeafLaunchCommand(
      { kind: "leaf", id: 7, lastCommand: "codex", autoLaunch: true },
      7,
      null,
    ),
  ).toEqual({ kind: "leaf", id: 7 });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `pnpm vitest run src/modules/terminal/lib/panes.test.ts`

Expected: FAIL because `setLeafLaunchCommand` is not exported.

- [ ] **Step 3: Implement the recursive launch-plan update**

Add to `panes.ts`:

```ts
export function setLeafLaunchCommand(
  node: PaneNode,
  id: PaneId,
  command: string | null,
): PaneNode {
  if (isLeaf(node)) {
    if (node.id !== id) return node;
    if (!command) {
      const { lastCommand: _lastCommand, autoLaunch: _autoLaunch, ...rest } = node;
      return rest;
    }
    if (node.lastCommand === command && node.autoLaunch === true) return node;
    return { ...node, lastCommand: command, autoLaunch: true };
  }
  let changed = false;
  const children = node.children.map((child) => {
    const next = setLeafLaunchCommand(child, id, command);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...node, children } : node;
}
```

Expose a matching `setLeafLaunchCommand(leafId, command)` callback from `useTabs` that updates the containing terminal tab with this helper.

- [ ] **Step 4: Run the pane tests**

Run: `pnpm vitest run src/modules/terminal/lib/panes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the launch metadata model**

```bash
git add src/modules/terminal/lib/panes.ts src/modules/terminal/lib/panes.test.ts src/modules/tabs/lib/useTabs.ts
git commit -m "Model terminal pane launch replacement"
```

### Task 2: Add a Settings-driven agent menu

**Files:**
- Create: `src/modules/terminal/TerminalAgentSwitcher.tsx`
- Create: `src/modules/terminal/TerminalAgentSwitcher.test.ts`
- Modify: `src/modules/terminal/PaneTreeView.tsx`

- [ ] **Step 1: Write failing source-contract tests**

Create `TerminalAgentSwitcher.test.ts` with assertions for the required sources and command precedence:

```ts
import { describe, expect, it } from "vitest";
import { resolveAgentSwitchCommand } from "./TerminalAgentSwitcher";

describe("resolveAgentSwitchCommand", () => {
  it("prefers the Settings override", () => {
    expect(resolveAgentSwitchCommand("codex", { codex: "codex --fast" })).toBe(
      "codex --fast",
    );
  });

  it("uses the catalog launch command without an override", () => {
    expect(resolveAgentSwitchCommand("codex", {})).toBeTruthy();
  });

  it("uses no command for Terminal", () => {
    expect(resolveAgentSwitchCommand(null, {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run the menu test and confirm it fails**

Run: `pnpm vitest run src/modules/terminal/TerminalAgentSwitcher.test.ts`

Expected: FAIL because the component and resolver do not exist.

- [ ] **Step 3: Implement `TerminalAgentSwitcher`**

The component must:

```ts
type Props = {
  currentAgent: CliAgent | null;
  onSelect: (agent: CliAgent | null, command: string | null) => void;
};
```

Read `cliAgentIds`, `disabledCliAgentIds`, and `agentLaunchCommands` from `usePreferencesStore`. Build menu entries with `getEnabledCliAgentDefinitions`, render each with `AgentCliIcon`, render `Terminal` with `ComputerTerminal02Icon`, and use `Tick02Icon` for the active entry. Resolve commands with:

```ts
export function resolveAgentSwitchCommand(
  agent: CliAgent | null,
  overrides: Record<string, string>,
): string | null {
  if (!agent) return null;
  const definition = CLI_AGENT_BY_ID[agent];
  return overrides[agent]?.trim() || definition.launch || definition.command;
}
```

Use existing `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, and `DropdownMenuTrigger`. Stop pointer propagation on the trigger so opening the menu does not start pane dragging.

- [ ] **Step 4: Replace the passive header logo**

In `FloatingTerminalOverlay`, replace the standalone `AgentCliIcon` render with:

```tsx
<TerminalAgentSwitcher
  currentAgent={cliAgent}
  onSelect={onSwitchAgent}
/>
```

Render the Terminal trigger when `cliAgent` is null so a plain shell can also switch to an enabled agent.

- [ ] **Step 5: Run the component tests and typecheck**

Run: `pnpm vitest run src/modules/terminal/TerminalAgentSwitcher.test.ts src/modules/terminal/PaneTreeView.test.ts && pnpm exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit the menu component**

```bash
git add src/modules/terminal/TerminalAgentSwitcher.tsx src/modules/terminal/TerminalAgentSwitcher.test.ts src/modules/terminal/PaneTreeView.tsx
git commit -m "Add terminal header agent switcher"
```

### Task 3: Replace and persist the selected CLI

**Files:**
- Modify: `src/modules/terminal/lib/useTerminalSession.ts`
- Modify: `src/modules/terminal/TerminalStack.tsx`
- Modify: `src/modules/terminal/PaneTreeView.tsx`
- Modify: `src/app/App.tsx`
- Create: `src/modules/terminal/lib/useTerminalSession.source.test.ts`
- Test: `src/app/App.test.ts`

- [ ] **Step 1: Write failing lifecycle source tests**

Assert that the session replacement updates `launchCommand`, clears the remembered CLI when selecting Terminal, and respawns the same leaf:

```ts
expect(sessionSource).toContain("export async function replaceSessionCommand");
expect(sessionSource).toContain("s.launchCommand = command ?? undefined");
expect(sessionSource).toContain("setAgentCliCommand(leafId, command ?? undefined)");
expect(appSource).toContain("handleSwitchTerminalAgent");
expect(appSource).toContain('invoke("db_save_pane"');
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm vitest run src/modules/terminal/lib/useTerminalSession.source.test.ts src/app/App.test.ts`

Expected: FAIL because the replacement API and handler are absent.

- [ ] **Step 3: Add `replaceSessionCommand`**

In `useTerminalSession.ts`, export:

```ts
export async function replaceSessionCommand(
  leafId: number,
  cwd: string | undefined,
  command: string | null,
): Promise<void> {
  const session = sessions.get(leafId);
  if (!session || session.disposed) return;
  session.launchCommand = command ?? undefined;
  session.interactiveCodingAgent = Boolean(command && isInteractiveCodingAgentCommand(command));
  session.agentResponseRequested = false;
  setAgentCliCommand(leafId, command ?? undefined);
  await respawnSession(leafId, cwd, Boolean(command));
}
```

- [ ] **Step 4: Thread the selection callback to `App`**

Add `onSwitchAgent: (leafId: number, command: string | null) => void` to `PaneTreeView` and `TerminalStack`. In `App`, implement `handleSwitchTerminalAgent` to:

1. Locate the terminal tab and leaf.
2. Read its cwd.
3. Call `setLeafLaunchCommand(leafId, command)`.
4. Persist `{ lastCommand: command, autoLaunch: Boolean(command) }` when the tab belongs to a workspace.
5. Await `replaceSessionCommand(leafId, cwd, command)`.
6. Restore focus to `terminalRefs.current.get(leafId)`.

Pass the handler to `TerminalStack`.

- [ ] **Step 5: Verify focused behavior**

Run: `pnpm vitest run src/modules/terminal/lib/useTerminalSession.source.test.ts src/modules/terminal/TerminalAgentSwitcher.test.ts src/modules/terminal/PaneTreeView.test.ts src/app/App.test.ts && pnpm exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit lifecycle wiring**

```bash
git add src/modules/terminal/lib/useTerminalSession.ts src/modules/terminal/TerminalStack.tsx src/modules/terminal/PaneTreeView.tsx src/app/App.tsx src/modules/terminal/lib/useTerminalSession.source.test.ts src/app/App.test.ts
git commit -m "Switch coding agents within terminal panes"
```

### Task 4: Full verification

**Files:**
- Modify only if verification finds a defect.

- [ ] **Step 1: Run focused tests**

Run: `pnpm vitest run src/modules/terminal/TerminalAgentSwitcher.test.ts src/modules/terminal/PaneTreeView.test.ts src/modules/terminal/lib/panes.test.ts src/modules/terminal/lib/useTerminalSession.source.test.ts src/app/App.test.ts`

Expected: PASS.

- [ ] **Step 2: Run static verification**

Run: `pnpm exec tsc --noEmit && pnpm build && git diff --check`

Expected: typecheck and build succeed; diff check emits no output.

- [ ] **Step 3: Verify in the live desktop app**

In one workspace pane, exercise:

1. Codex → another enabled agent: same leaf and cwd, new CLI starts.
2. Agent → Terminal: same leaf and cwd, plain shell prompt appears.
3. Terminal → Codex: same leaf and cwd, Codex starts.
4. Reopen the workspace: the chosen launch plan is restored.

Expected: no additional tab, pane, or worktree is created during any switch.

- [ ] **Step 4: Commit any verification-only correction**

If no correction was necessary, do not create an empty commit. Otherwise stage only the affected feature files and use a Lore-compliant commit describing the verified defect.
