# Terminal Collaboration Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe collaboration controls to existing standard terminal tabs: typed native access, output activity, explicit input broadcast, and opt-in agent worktree isolation.

**Architecture:** `TerminalStack` owns ephemeral per-tab collaboration state; `useTerminalSession` owns live PTY behavior. Pure helpers define activity and broadcast target resolution before UI wiring. Agent worktree setup is encoded into the initial shell command so the agent never starts in the source checkout when isolation is selected.

**Tech Stack:** React 19, TypeScript, Vitest, Tauri 2, Rust, `portable-pty`, existing git/workspace modules.

---

## Files and ownership

| File | Responsibility |
| --- | --- |
| `src/modules/terminal/lib/terminalActivity.ts` | Pure output/idle transition rules. |
| `src/modules/terminal/lib/terminalBroadcast.ts` | Pure target sanitization and fan-out selection. |
| `src/modules/terminal/lib/useTerminalSession.ts` | Feed output activity and route user input through broadcast resolver. |
| `src/modules/tabs/lib/useTabs.ts` | Own collaboration state and actions for a terminal tab. |
| `src/modules/terminal/PaneTreeView.tsx` | Present activity and broadcast controls; pass tab actions into panes. |
| `src/modules/terminal/lib/worktreeBridge.ts` | Typed frontend boundary for collaboration-native calls. |
| `src-tauri/src/modules/git/*` | Authorize, create, inspect, and safely refuse cleanup of managed worktrees. |

### Task 1: Establish testable terminal collaboration state

**Files:**
- Create: `src/modules/terminal/lib/terminalActivity.test.ts`
- Create: `src/modules/terminal/lib/terminalActivity.ts`
- Create: `src/modules/terminal/lib/terminalBroadcast.test.ts`
- Create: `src/modules/terminal/lib/terminalBroadcast.ts`
- Modify: `src/modules/tabs/lib/useTabs.ts`
- Test: `src/modules/tabs/lib/useTabs.test.ts` (or a focused new test beside it)

- [x] Write failing tests for output activity and deduplicated selected targets.
- [x] Run `pnpm vitest run src/modules/terminal/lib/terminalActivity.test.ts src/modules/terminal/lib/terminalBroadcast.test.ts`; confirmed RED from the missing modules.
- [x] Implement pure helpers with `noteTerminalOutput(now, quietWindowMs)` and `resolveBroadcastTargets(enabled, sourceLeafId, selectedLeafIds, liveLeafIds)`.
- [x] Keep collaboration state ephemeral in `TerminalStack`, default it to disabled, and prune targets against registered live terminal sessions.
- [x] Re-run focused state suites for defaults, selection, duplicate prevention, and stale target pruning.
- [x] Commit the focused state slice using the repository Lore trailer protocol.

### Task 2: Add output-driven activity without changing input behavior

**Files:**
- Modify: `src/modules/terminal/lib/useTerminalSession.ts`
- Modify: `src/modules/terminal/TerminalPane.tsx`
- Modify: `src/modules/terminal/PaneTreeView.tsx`
- Test: `src/modules/terminal/lib/useTerminalSession.test.ts` or a new focused test

- [x] Write fake-timer coverage proving output activates a pane, later output extends expiry, and disposal clears activity.
- [x] Use the Task 1 activity helper at `deliverPtyBytes`; do not classify agent CLI semantics as collaboration activity.
- [x] Thread an activity callback through `TerminalPane` and display a non-interactive pane indicator in `PaneTreeView`.
- [x] Re-run focused tests and `pnpm exec tsc --noEmit`.
- [x] Commit the activity slice with focused-test evidence.

### Task 3: Add opt-in broadcast for standard terminal panes

**Files:**
- Modify: `src/modules/terminal/lib/rendererPool.ts`
- Modify: `src/modules/terminal/lib/useTerminalSession.ts`
- Modify: `src/modules/terminal/PaneTreeView.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/modules/terminal/lib/terminalBroadcast.test.ts`

- [x] Write tests for one target per live selected leaf and no fan-out from programmatic writes or stale leaves.
- [x] Apply the resolver only to xterm-originated input immediately before `writeToSessionPty`.
- [x] Wire explicit target and enable controls from `TerminalStack` into `PaneTreeView` while preserving focus behavior.
- [x] Ensure stale/closed targets are ignored and disabled broadcast returns the source leaf only.
- [x] Run focused Vitest, `pnpm exec tsc --noEmit`, and `pnpm build`; commit the slice.

### Task 4: Add opt-in agent worktree isolation behind a typed bridge

**Files:**
- Create: `src/modules/terminal/lib/worktreeBridge.ts`
- Create: `src/modules/terminal/lib/worktreeBridge.test.ts`
- Modify: `src/modules/terminal/lib/panes.ts`
- Modify: `src/modules/tabs/lib/useTabs.ts`
- Modify: `src-tauri/src/modules/git/commands.rs`
- Modify: `src-tauri/src/modules/git/operations.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/modules/git/*_test.rs`

- [x] Add deterministic, shell-safe worktree path/branch derivation tests.
- [x] Add an opt-in launch control; imported/resumed sessions remain unwrapped.
- [x] Create or reuse the isolated worktree before starting the agent command and never fall back to the source checkout on failure.
- [x] Preserve worktrees when panes close; automatic/destructive cleanup remains outside this feature's scope.
- [x] Run focused Vitest, `pnpm build`, and `cd src-tauri && cargo check --all-targets --locked`; commit the slice.

### Task 5: Verify integration and document recovery

**Files:**
- Modify: `docs/plans/active/2026-08-16-terminal-collaboration-capabilities.md`
- Test: affected Vitest suites and Rust test modules

- [x] Verify direct terminal creation, terminal splitting/closing, canvas terminal isolation, broadcast off/on, activity expiry, and worktree launch construction through focused tests and type checking.
- [x] Run `pnpm test`, `pnpm build`, and `cd src-tauri && cargo check --all-targets --locked`.
- [x] Record commands and results in this plan. The plan stays in `active/` because project policy forbids moving/deleting files without explicit permission.

## Verification record

- `pnpm vitest run src/modules/terminal/lib/terminal-native.test.ts src/modules/terminal/lib/terminalActivity.test.ts src/modules/terminal/lib/terminalBroadcast.test.ts src/modules/terminal/lib/terminalBroadcastRuntime.test.ts src/modules/ai/lib/agentWorktree.test.ts src/modules/workspaces/WorkspacesPanel.test.ts src/modules/terminal/PaneTreeView.test.ts src/modules/terminal/TerminalStack.source.test.ts` — 8 files and 35 tests passed.
- `pnpm exec tsc --noEmit` — passed.
- `pnpm build` — passed (2,466 modules transformed).
- `cd src-tauri && cargo check --all-targets --locked` — passed.
- `pnpm test` — 109 files and 574 tests passed; the run remains non-zero only because the unrelated, untracked `services/cmdspace-relay/test/relay-state.test.js` contains no Vitest suite.

## Delivery notes

- Collaboration state is intentionally ephemeral rather than persisted into workspace layouts.
- Broadcast applies only to registered standard-terminal sessions and only to xterm user input.
- Worktree isolation is opt-in and keeps cleanup deliberate; this slice never invokes `git worktree remove`.
