# Workspace Loading Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make workspace switching feel immediate and prevent Canvas restore from blocking the entire app on avoidable agent-session discovery.

**Architecture:** Preserve the existing workspace/tab ownership and persistence contracts. Split the user-visible activation from expensive background reconciliation, and keep loading feedback local to the workspace surface instead of replacing the whole application shell.

**Tech Stack:** React 19, TypeScript, Vitest, Tauri IPC, existing workspace persistence helpers.

---

### Task 1: Non-blocking workspace loading presentation

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/lib/startupGate.ts`
- Test: `src/app/lib/startupGate.test.ts`

- [x] Keep the already-initialized shell visible during workspace switching.
- [x] Show a local loading state in the workspace panel while a workspace is restoring.
- [x] Preserve the initial startup gate so the bootstrap shell is not exposed before the first workspace is ready.
- [x] Verify that switching/loading does not alter tab ownership or terminal cleanup semantics.

### Task 2: Background native-session reconciliation

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/lib/useWorkspaceSelection.ts`
- Test: `src/app/lib/useWorkspaceSelection.test.ts`

- [x] Restore a valid persisted Canvas diagram without waiting for full CLI-session discovery.
- [x] Move native-session reconciliation after visible workspace activation where the existing data model permits it.
- [x] Keep standard workspace launch-command restoration behavior intact.
- [x] Add tests proving Canvas activation is not blocked by delayed session discovery and that pane metadata reconciliation remains eventually persisted.

### Task 3: Verification

- [x] Run focused workspace, startup, Canvas, and App tests.
- [x] Run TypeScript validation and production build.
- [x] Inspect the final diff for accidental changes to the user's existing worktree changes.
- [x] Report remaining unknowns requiring manual GUI timing measurement.
