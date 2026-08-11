# Terminal Allocation and Multi-Session Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show ordinary terminal allocation explicitly and allow atomic selection of multiple imported sessions during workspace setup.

**Architecture:** Keep the selected terminal count authoritative and derive regular terminals from unused slots. Extend the existing import dialog with an opt-in multiple-selection mode and a batch callback, leaving the active-workspace single import flow unchanged.

**Tech Stack:** React 19, TypeScript, Vitest, Tauri v2

---

### Task 1: Lock allocation behavior

**Files:**
- Modify: `src/modules/workspaces/lib/importSessions.ts`
- Test: `src/modules/workspaces/lib/importSessions.test.ts`

- [ ] Add a failing unit test asserting that 10 total terminals, 1 imported session, and 8 CLI assignments produce 1 regular terminal.
- [ ] Run `pnpm vitest run src/modules/workspaces/lib/importSessions.test.ts` and confirm the missing helper fails.
- [ ] Add a small clamped `regularTerminalCount(total, imported, cli)` helper.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Add batch selection to the import dialog

**Files:**
- Modify: `src/modules/workspaces/ImportSessionDialog.tsx`
- Test: `src/modules/workspaces/ImportSessionDialog.source.test.ts`

- [ ] Add failing source assertions for multiple selection, selected count, and the batch action.
- [ ] Run the focused source test and confirm it fails on the missing controls.
- [ ] Add opt-in `multiple` and `onImportMany` props, row toggle state, accessible selection state, and an `Add N sessions` footer action.
- [ ] Preserve immediate single-session import when `multiple` is false.
- [ ] Re-run the focused source test and confirm it passes.

### Task 3: Wire atomic setup allocation

**Files:**
- Modify: `src/modules/workspaces/WorkspacesPanel.tsx`
- Test: `src/modules/workspaces/ImportSessionDialog.source.test.ts`

- [ ] Add failing source assertions for `Regular terminals` and the batch handler.
- [ ] Run the focused source test and confirm it fails.
- [ ] Render the derived regular-terminal row and pass multiple-selection props to the dialog.
- [ ] Validate active sessions, duplicates, and capacity for the whole batch before updating selected imports once.
- [ ] Re-run focused workspace tests.

### Task 4: Verify the feature

**Files:**
- Verify only

- [ ] Run `pnpm test` and confirm zero failures.
- [ ] Run `pnpm build` and confirm TypeScript and Vite production build success.
- [ ] Run `cargo test session_import --locked` in `src-tauri`.
- [ ] Run `cargo check --all-targets --locked` and `cargo clippy --all-targets --locked -- -D warnings` in `src-tauri`.
- [ ] Run `git diff --check` and review only the intended changes.
