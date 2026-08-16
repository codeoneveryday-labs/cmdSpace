# Terminal Collaboration Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe collaboration controls to existing standard terminal tabs: typed native access, output activity, explicit input broadcast, and opt-in agent worktree isolation.

**Architecture:** `useTabs` owns persistent per-tab collaboration metadata; `useTerminalSession` owns live PTY behavior. Pure helpers define activity and broadcast target resolution before UI wiring. Native worktree commands stay behind a small typed bridge and must authorize paths through the workspace registry.

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
- [ ] Extend `TerminalTab` with default-disabled broadcast state and actions that preserve existing tabs and prune removed leaves.
- [ ] Re-run the focused suites and add tab-state tests for defaults, selection, and close pruning.
- [ ] Commit the focused state slice using the repository Lore trailer protocol.

### Task 2: Add output-driven activity without changing input behavior

**Files:**
- Modify: `src/modules/terminal/lib/useTerminalSession.ts`
- Modify: `src/modules/terminal/TerminalPane.tsx`
- Modify: `src/modules/terminal/PaneTreeView.tsx`
- Test: `src/modules/terminal/lib/useTerminalSession.test.ts` or a new focused test

- [ ] Write a failing fake-timer test proving a PTY output chunk makes a leaf active, a second chunk extends idle expiry, and disposal/exit clears it.
- [ ] Run that focused test and confirm RED.
- [ ] Use the Task 1 activity helper at `deliverPtyBytes`; do not classify echoed user input or agent CLI semantics as collaboration activity.
- [ ] Thread an activity callback through `TerminalPane` and display a non-interactive pane indicator in `PaneTreeView`.
- [ ] Re-run the focused test, then `pnpm exec tsc --noEmit`.
- [ ] Commit the activity slice with focused-test evidence.

### Task 3: Add opt-in broadcast for standard terminal panes

**Files:**
- Modify: `src/modules/terminal/lib/rendererPool.ts`
- Modify: `src/modules/terminal/lib/useTerminalSession.ts`
- Modify: `src/modules/terminal/PaneTreeView.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/modules/terminal/lib/terminalBroadcast.test.ts`

- [ ] Write failing tests for one write per live selected leaf and no fan-out for resize, initial commands, imperative `TerminalPaneHandle.write`, or stale leaves.
- [ ] Run the broadcast suite and confirm RED.
- [ ] Add a resolver callback to the renderer-pool input boundary; it must apply only to xterm user input immediately before `writeToSessionPty`.
- [ ] Wire selected targets and the enable toggle from `useTabs` through `App.tsx` into `PaneTreeView`; use explicit pane controls and preserve focus behavior.
- [ ] Ensure close removes selection and a disabled broadcast mode returns the source leaf only.
- [ ] Run focused Vitest, `pnpm exec tsc --noEmit`, and `pnpm build`; commit the slice.

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

- [ ] Write failing TypeScript serialization tests and Rust unit tests for repository authorization, deterministic branch/path construction, dirty-worktree refusal, and out-of-root cleanup refusal.
- [ ] Run each focused test and confirm RED.
- [ ] Implement a typed bridge that passes the current `WorkspaceEnv`; add Rust commands that reuse the existing workspace registry and git-process helpers.
- [ ] Store only worktree path/branch metadata in a leaf, launch the agent PTY only after successful creation, and never fall back to the original repo on failure.
- [ ] Add explicit UI launch/cleanup paths; closing a pane must only close its PTY.
- [ ] Run focused Vitest and Cargo tests, `pnpm build`, and `cd src-tauri && cargo check --all-targets --locked`; commit the slice.

### Task 5: Verify integration and document recovery

**Files:**
- Modify: `docs/plans/active/2026-08-16-terminal-collaboration-capabilities.md`
- Test: affected Vitest suites and Rust test modules

- [ ] Verify direct terminal creation, terminal splitting/closing, canvas terminal isolation, broadcast off/on, activity expiry, successful worktree launch, and dirty-worktree cleanup refusal.
- [ ] Run `pnpm test`, `pnpm build`, and `cd src-tauri && cargo check --all-targets --locked`; run Clippy when practical.
- [ ] Record commands and results in this plan, then move it to `docs/plans/completed/` only after every requested capability is verified.
