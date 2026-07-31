# Canvas Terminal Docking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge independent Canvas terminals into tabs or four-direction splits without restarting their PTYs.

**Architecture:** Persist a recursive terminal dock tree separately from flat terminal node records. Keep every `CanvasTerminalNode` in one stable, terminal-ID-keyed React sibling list and derive its rectangle/visibility from the dock tree, so layout mutation never reparents or unmounts a live PTY.

**Tech Stack:** React 19, TypeScript, Vitest, xterm.js, Tailwind CSS, existing Tauri PTY bridge.

---

### Task 1: Add and test the pure terminal dock model

**Files:**
- Modify: `src/modules/tabs/lib/useTabs.ts`
- Create: `src/modules/architecture/terminalDockLayout.ts`
- Create: `src/modules/architecture/terminalDockLayout.test.ts`

- [ ] **Step 1: Write failing type and normalization tests**

Add tests that construct two terminal IDs and assert that normalization creates
one single-tab group per terminal when no saved groups exist. Add corrupt-seed
cases for duplicate membership, missing terminal IDs, empty tabs, and one-sided
splits.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm test -- src/modules/architecture/terminalDockLayout.test.ts
```

Expected: FAIL because `terminalDockLayout.ts` and the persisted dock types do
not exist.

- [ ] **Step 3: Add the persisted types and minimal normalizer**

Add `ArchitectureTerminalDockTabs`, `ArchitectureTerminalDockSplit`,
`ArchitectureTerminalDockNode`, and `ArchitectureTerminalDockGroup` to
`useTabs.ts`. Extend `ArchitectureDiagram` with:

```ts
terminalDockGroups?: ArchitectureTerminalDockGroup[];
```

Implement:

```ts
normalizeTerminalDockGroups(
  terminalNodes: readonly Pick<ArchitectureDiagramNode, "id" | "x" | "y" | "width" | "height">[],
  savedGroups: unknown,
): ArchitectureTerminalDockGroup[]
```

The function must return each current terminal exactly once and create fallback
single-tab groups from node bounds.

- [ ] **Step 4: Verify normalization GREEN**

Run the focused test. Expected: PASS.

- [ ] **Step 5: Add failing layout and hit-test tests**

Cover:

- Recursive 50/50 horizontal and vertical geometry.
- Header `< 38px` resolves to `tab`.
- Left/right/top/bottom 12%-capped bands resolve to their split edge.
- Center body resolves to `null`.
- A lone terminal cannot dock onto its own stack.

- [ ] **Step 6: Implement layout and hit testing**

Expose:

```ts
layoutTerminalDockGroups(groups): TerminalDockStackLayout[]
resolveTerminalDockDrop(pointer, stacks, sourceTerminalId): TerminalDockDropTarget | null
```

Use screen-space rectangles for hit testing so the 38px/60px Cate thresholds do
not vary with Canvas zoom.

- [ ] **Step 7: Verify geometry GREEN**

Run the focused test. Expected: PASS.

### Task 2: Add and test dock-tree mutation

**Files:**
- Modify: `src/modules/architecture/terminalDockLayout.ts`
- Modify: `src/modules/architecture/terminalDockLayout.test.ts`

- [ ] **Step 1: Write failing mutation tests**

Cover:

- Header drop appends the source to target tabs and activates it.
- Four edge drops create the correct split direction/order.
- Moving between groups removes an empty source group.
- Removing from a split collapses the surviving branch.
- Free drop detaches one terminal into a new group.
- Free drop of an already-single terminal moves that group.
- Deleting a terminal removes it from tabs and collapses the tree.
- Activating a tab changes only the target stack.

- [ ] **Step 2: Run focused tests and verify RED**

Expected: FAIL because mutation functions are absent.

- [ ] **Step 3: Implement minimal immutable mutations**

Add:

```ts
dockTerminal(groups, sourceTerminalId, target)
detachTerminal(groups, terminalId, bounds)
removeTerminalFromDock(groups, terminalId)
activateTerminalTab(groups, stackId, terminalId)
updateTerminalGroupBounds(groups, groupId, bounds)
```

Keep IDs stable, clamp split ratios to a safe range, and never mutate input
objects.

- [ ] **Step 4: Verify mutation GREEN**

Run focused tests. Expected: PASS.

### Task 3: Persist dock groups and include them in Undo

**Files:**
- Modify: `src/modules/architecture/ArchitectureCanvas.tsx`
- Modify: `src/modules/architecture/ArchitectureCanvas.render.test.tsx`

- [ ] **Step 1: Write failing seed/persistence tests**

Extend the render test seed with a tab group and assert both terminal IDs are
rendered with stack metadata. Add a test that invalid saved dock data is ignored
without throwing.

- [ ] **Step 2: Run the render test and verify RED**

Run:

```bash
pnpm test -- src/modules/architecture/ArchitectureCanvas.render.test.tsx
```

Expected: FAIL because `ArchitectureCanvas` drops `terminalDockGroups`.

- [ ] **Step 3: Normalize and store dock groups**

Change `normalizeDiagramSeed` to return dock groups. Add
`terminalDockGroups` state. Include cloned groups in `HistorySnapshot`,
`pushHistory`, `undoCanvas`, and `onDiagramChange`.

New terminal placement must append a single-tab group. Delete and clear paths
must call `removeTerminalFromDock`.

- [ ] **Step 4: Verify persistence GREEN**

Run the render and dock unit tests. Expected: PASS.

### Task 4: Render tabs and splits while preserving PTY mounts

**Files:**
- Modify: `src/modules/architecture/ArchitectureCanvas.tsx`
- Modify: `src/modules/architecture/CanvasTerminalNode.tsx`
- Modify: `src/modules/architecture/CanvasTerminalNode.source.test.ts`
- Modify: `src/styles/globals.css` only if the existing terminal classes cannot
  express the hidden-tab state.

- [ ] **Step 1: Write failing source/render assertions**

Assert that:

- The terminal map remains keyed by `node.id`.
- Inactive tabs use a visibility state instead of conditional omission.
- `CanvasTerminalNode` accepts a tab list and active-tab callback.
- Tab buttons stop pointer propagation and expose selected semantics.
- The PTY-opening effect remains mount-only and `session.close` remains in its
  cleanup.

- [ ] **Step 2: Run tests and verify RED**

Expected: FAIL because tab props and visibility metadata do not exist.

- [ ] **Step 3: Derive terminal leaf rectangles**

Compute stack layouts from dock groups, map each terminal ID to its stack rect,
and render all terminal components as the same flat sibling list. Use
`visibility: hidden` and `pointer-events: none` for inactive tabs.

- [ ] **Step 4: Render the tab header**

Pass tab IDs/labels into `CanvasTerminalNode`. Clicking selects a tab; pointer
movement from the active tab/header continues to start Canvas drag. Preserve
maximize, close, focus, CWD updates, theme updates, IME handling, and xterm
fitting.

- [ ] **Step 5: Verify stable rendering GREEN**

Run Canvas terminal source/render tests and dock unit tests. Expected: PASS.

### Task 5: Add docking drag previews and commit behavior

**Files:**
- Modify: `src/modules/architecture/ArchitectureCanvas.tsx`
- Modify: `src/modules/architecture/ArchitectureCanvas.render.test.tsx`
- Modify: `src/modules/architecture/terminalDockLayout.test.ts`

- [ ] **Step 1: Write failing drop-state tests**

Add pure tests that project Canvas stack rectangles to client rectangles and
confirm each pointer region produces the expected preview rectangle. Add render
assertions for `data-terminal-drop-target="tab"` and
`data-terminal-drop-target="split-right"` markers.

- [ ] **Step 2: Run tests and verify RED**

Expected: FAIL because docking preview state is absent.

- [ ] **Step 3: Freeze source bounds at drag start**

Extend terminal drag state with the current rendered leaf bounds. Continue to
render the existing free-move ghost from those bounds.

- [ ] **Step 4: Resolve and paint the target**

During pointer move:

- Convert stack Canvas rectangles to client rectangles.
- Resolve the smallest valid target stack under the pointer.
- Paint a half-stack blue indicator for splits.
- Paint a compact blue header insertion indicator for tabs.

Use `pointer-events: none` and avoid layout-changing animation.

- [ ] **Step 5: Commit tab, split, or detach**

At pointer release, call `dockTerminal` for a valid target; otherwise call
`detachTerminal` with the free ghost bounds. Copy the target terminal's
`frameId` to the source on dock.

- [ ] **Step 6: Verify interaction GREEN**

Run all architecture tests. Expected: PASS.

### Task 6: Preserve resize, maximize, selection, and deletion behavior

**Files:**
- Modify: `src/modules/architecture/ArchitectureCanvas.tsx`
- Modify: `src/modules/architecture/terminalDockLayout.ts`
- Modify: `src/modules/architecture/terminalDockLayout.test.ts`

- [ ] **Step 1: Write failing regression tests**

Cover outer group resize, maximize/restore without tree mutation, close/delete
of active and inactive tabs, and Undo after dock/detach.

- [ ] **Step 2: Run tests and verify RED**

Expected: FAIL until group-aware behavior is wired.

- [ ] **Step 3: Route terminal geometry through group bounds**

Resize modifies the owning group bounds. Maximize uses transient Canvas state and
does not rewrite the persisted tree. Selection outlines and corner hit areas use
the owning group's outer rectangle.

- [ ] **Step 4: Route terminal removal through dock cleanup**

Close, Delete/Backspace, eraser, and clear-canvas remove terminal membership
before the terminal React key disappears.

- [ ] **Step 5: Verify regressions GREEN**

Run all architecture tests. Expected: PASS.

### Task 7: Update product proof and run full verification

**Files:**
- Modify: `docs/product/architecture-canvas.md`
- Create: `docs/stories/epics/E03-architecture-canvas/US-023-canvas-terminal-docking.md`

- [ ] **Step 1: Document the completed behavior and evidence**

Record terminal-only v1 scope, all five drop outcomes, stable PTY requirement,
backward compatibility, and exact verification commands.

- [ ] **Step 2: Run focused tests**

```bash
pnpm test -- \
  src/modules/architecture/terminalDockLayout.test.ts \
  src/modules/architecture/ArchitectureCanvas.render.test.tsx \
  src/modules/architecture/CanvasTerminalNode.source.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full frontend tests**

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Run typecheck and production build**

```bash
pnpm exec tsc --noEmit
pnpm build
```

Expected: both commands exit 0.

- [ ] **Step 5: Record known platform gap honestly**

If interactive Tauri verification is not available, record that automated
geometry, persistence, render, type, and build proof passed but live pointer
dragging in the native shell remains a manual validation item.

