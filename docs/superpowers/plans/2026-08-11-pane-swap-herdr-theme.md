# Terminal Pane Swap and Herdr Theme Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users swap same-tab terminal panes by dragging headers and let Herdr follow cmdSpace's host light/dark palette through OSC reports.

**Architecture:** Keep `PaneNode` as the layout source of truth and add a pure tree transformation for leaf swaps. Add pointer drag state at the leaf header boundary in `PaneTreeView`; terminal renderer changes only gate existing OSC color reports by detected Herdr session.

**Tech Stack:** React 19, TypeScript, xterm.js, Vitest, Tauri PTY bridge.

---

### Task 1: Add pure pane-tree swap transformation

**Files:**
- Modify: `src/modules/terminal/lib/panes.ts`
- Test: `src/modules/terminal/lib/panes.import.test.ts` or a new focused `src/modules/terminal/lib/panes.swap.test.ts`

- [x] Write tests for swapping two leaves in a flat split, nested splits, missing IDs, and identical IDs.
- [x] Run the focused test and verify the new test fails because `swapLeafNodes` is absent.
- [x] Implement `swapLeafNodes(tree, sourceId, targetId)` with structural sharing and no mutation.
- [x] Run the focused test and verify it passes.

### Task 2: Add header drag-to-swap UX

**Files:**
- Modify: `src/modules/terminal/PaneTreeView.tsx`
- Test: `src/modules/terminal/PaneTreeView.test.ts`

- [x] Extend source tests to require a header-only pointer drag handler, `data-pane-drag-handle`, target highlighting, Escape/pointer-cancel cleanup, and `swapLeafNodes` on valid drop.
- [x] Run the source test and verify it fails before implementation.
- [x] Add a small pointer state machine: capture pointer on header, track the leaf under the pointer with `elementsFromPoint`, highlight only valid leaf targets, commit one swap on pointerup, and clean up on cancel/Escape/blur.
- [x] Keep control buttons outside the drag handler and preserve existing focus/hydration behavior.
- [x] Run the focused PaneTreeView tests and verify they pass.

### Task 3: Forward Herdr OSC palette reports only to Herdr

**Files:**
- Modify: `src/modules/terminal/lib/rendererPool.ts`
- Modify: `src/modules/terminal/lib/useTerminalSession.ts`
- Test: `src/modules/terminal/lib/rendererPool.source.test.ts`

- [x] Add a test asserting the OSC report branch checks the detected CLI identity before forwarding.
- [x] Run the focused test and verify it fails.
- [x] Add a session-level predicate for Herdr (`detectCliAgent(...) === "herdr"`) and use it in `term.onData`: forward OSC 10/11 reports to Herdr, drop them for ordinary shells.
- [x] Keep existing theme restoration after parsed writes so Herdr cannot change cmdSpace's xterm palette.
- [x] Run focused renderer tests and verify they pass.

### Task 4: Full validation and delivery

**Files:**
- No additional source files.

- [x] Run focused terminal tests.
- [x] Run `pnpm test -- --run` (92 files, 507 tests).
- [x] Run `pnpm build`.
- [x] Run `git diff --check` and TypeScript validation.
- [ ] Commit with Lore trailers, push `feat/221-pane-swap-herdr-theme`, and open a PR closing issue #221.
