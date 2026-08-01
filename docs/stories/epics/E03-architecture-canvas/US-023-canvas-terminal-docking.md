# US-023 — Dock Canvas terminals into tabs and splits

## Status

implemented

## Lane

normal

## Product Contract

Canvas terminals can be merged without restarting their independent PTYs.
Dropping on another terminal's header creates a tab. Dropping on any of its four
edges creates a left/right or top/bottom split. Dropping elsewhere keeps or
restores the source as a floating terminal.

Version 1 supports terminal-to-terminal docking only.

## Relevant Product Docs

- `docs/product/architecture-canvas.md`
- `docs/stories/epics/E03-architecture-canvas/US-013-canvas-terminal-node.md`

## Acceptance Criteria

- Dropping a terminal on a target header adds it as the active tab.
- Dropping on the left, right, top, or bottom edge creates the matching 50/50
  split.
- Split and tab target previews match the committed region.
- Dropping over the terminal body center does not dock it.
- Docking, tab switching, splitting, and detaching do not restart or close the
  source PTY.
- Closing or deleting a docked terminal closes only that terminal's PTY and
  collapses empty dock branches.
- Dock layout, active tabs, group bounds, terminal CWDs, and terminal launch
  commands survive Canvas save/reopen.
- Undo restores dock-tree mutations.
- Existing diagrams with no dock metadata open with every terminal as an
  independent floating group.
- Existing non-terminal Canvas behavior and legacy image data remain valid.

## Design Notes

- Commands: pointer-driven dock, split, detach, activate, delete, resize.
- Queries: derive visible stack rectangles and active terminal IDs from the
  persisted dock tree.
- API: no external API change.
- Tables: no database change; diagram JSON gains optional
  `terminalDockGroups` and Canvas workspaces store a versioned diagram envelope
  in their existing `pane_layout` field.
- Domain rules: every valid terminal ID appears in exactly one dock stack.
- UI surfaces: Architecture Canvas terminal overlay and terminal header.
- Performance: pan/zoom uses one GPU-transformed terminal world layer; xterm
  boxes retain canvas-space dimensions and do not fit/resize per camera tick.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Pure dock normalization, geometry, hit-test, and mutation tests |
| Integration | Architecture Canvas render/persistence/source tests |
| E2E | Native pointer drag check when an interactive Tauri runtime is available |
| Platform | macOS Canvas terminal drag/drop and PTY continuity |
| Release | Full frontend test suite, TypeScript, and production build |

## Harness Delta

The required `scripts/bin/harness-cli` binary is absent from this working tree,
so intake/story state cannot be mirrored into `harness.db` during this task. The
story file remains the durable fallback record.

## Evidence

- `pnpm exec vitest run src/modules/architecture src/app/App.test.ts
  src/modules/workspaces/WorkspacesPanel.test.ts` — 93/93 tests passed.
- `pnpm exec tsc --noEmit` — passed.
- `pnpm build` — passed; 1,446 modules transformed.
- `pnpm test` — 286/287 tests passed. The only failure is the pre-existing,
  unrelated `TerminalStack.source.test.ts` expectation for `border-2 z-10`
  while the current dirty `PaneTreeView.tsx` uses `z-30`.
- Native pointer/restart interaction was not run because the user explicitly
  requested no direct app testing.
