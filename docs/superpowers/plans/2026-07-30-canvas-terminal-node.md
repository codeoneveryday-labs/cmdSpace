# Canvas Terminal Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Architecture canvas Image toolbar action with independent Cate-style terminal nodes while keeping legacy image data loadable.

**Architecture:** Extend the existing architecture node model with `terminal`, add an HTML terminal overlay beside the SVG layer, and route each node directly through the existing `openPty` bridge. The canvas remains the geometry authority; each terminal component owns xterm/PTY lifecycle and reports geometry/CWD changes upward.

**Tech Stack:** React 19, TypeScript, SVG + HTML overlay, xterm.js, existing Tauri PTY IPC, Vitest.

---

### Task 1: Lock the replacement contract with source tests

**Files:**
- Modify: `src/modules/architecture/ArchitectureStack.source.test.ts`
- Modify: `src/modules/architecture/ArchitectureCanvas.render.test.tsx`

- [ ] Add failing assertions that the architecture shape registry keeps `image` for compatibility but excludes it from the toolbar and maps the replacement action to `terminal`.
- [ ] Add a failing render/source assertion for the terminal node kind and its saved `cwd`/geometry fields.
- [ ] Run `./node_modules/.bin/vitest run src/modules/architecture/ArchitectureStack.source.test.ts src/modules/architecture/ArchitectureCanvas.render.test.tsx` and confirm the failures are caused by the missing terminal contract.

### Task 2: Extend architecture data and replace the toolbar action

**Files:**
- Modify: `src/modules/tabs/lib/useTabs.ts`
- Modify: `src/modules/architecture/ArchitectureCanvas.tsx`
- Modify: `src/modules/architecture/ArchitectureStack.source.test.ts`

- [ ] Add `terminal` to `ArchitectureShapeKind` and add optional terminal metadata to `ArchitectureDiagramNode` without removing `image`.
- [ ] Add a terminal shape configuration and default size.
- [ ] Remove Image from the toolbar/palette and replace its slot with Add terminal using the terminal-plus icon.
- [ ] Change the `I` shortcut to create/select terminal mode and leave existing image rendering paths available only for restored diagrams.
- [ ] Normalize terminal labels, finite geometry, and optional CWD while retaining legacy image normalization.
- [ ] Run the targeted architecture tests and typecheck; fix only failures caused by this task.

### Task 3: Add the isolated canvas PTY terminal component

**Files:**
- Create: `src/modules/architecture/CanvasTerminalNode.tsx`
- Create: `src/modules/architecture/CanvasTerminalNode.test.tsx`
- Modify: `src/modules/terminal/lib/pty-bridge.ts`

- [ ] Write failing component tests for opening a PTY with the node CWD, forwarding terminal input, resizing from xterm fit dimensions, and closing exactly once on unmount.
- [ ] Implement a focused terminal component that creates its own xterm instance and calls `openPty` directly; do not import `TerminalPane`, `useTerminalSession`, or `rendererPool`.
- [ ] Add a small bridge callback for CWD metadata updates if the existing `openPty` surface does not expose the needed handler.
- [ ] Add a neutral Cate-like title bar, close affordance, xterm body, ResizeObserver, and cleanup path.
- [ ] Run the component test and confirm the PTY cleanup assertions pass.

### Task 4: Overlay terminal nodes and persist geometry

**Files:**
- Modify: `src/modules/architecture/ArchitectureCanvas.tsx`
- Modify: `src/modules/architecture/ArchitectureStack.tsx`
- Modify: `src/modules/tabs/lib/useTabs.ts`
- Modify: `src/app/App.tsx`

- [ ] Render terminal nodes in an absolutely positioned HTML layer derived from the same canvas view transform as SVG nodes.
- [ ] Route terminal title-bar pointer gestures to existing node drag state and route edge/corner gestures to resize state.
- [ ] Stop terminal-body pointer events from initiating canvas pan/drag while preserving canvas selection and deletion behavior.
- [ ] Add an `onDiagramChange` callback and update the owning Architecture tab with the latest nodes/edges after committed geometry/CWD/title changes.
- [ ] Ensure deleting a terminal node removes it from the diagram so component unmount closes its PTY; ensure clear removes all terminal nodes through the same path.
- [ ] Run architecture tests and typecheck.

### Task 5: Verify the complete behavior

**Files:**
- Modify: `docs/product/architecture-canvas.md`
- Modify: `docs/stories/epics/E03-architecture-canvas/US-013-canvas-terminal-node.md`

- [ ] Document the terminal-node contract and legacy-image compatibility.
- [ ] Run `./node_modules/.bin/tsc --noEmit`.
- [ ] Run `./node_modules/.bin/vitest run`.
- [ ] Run `git diff --check` and inspect the final changed-file list, preserving unrelated pre-existing worktree changes.
