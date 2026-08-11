# Execution Plan: Phase 2 Workspace Seams

Date: 2026-08-11

## Status

Active

## Outcome

Reduce `src/app/App.tsx` coordination load without changing behavior by moving
workspace selection/restoration and layout persistence behind focused module
interfaces, while retaining the existing Tauri commands and state owners.

## Context

- `CMDSPACE.md`: `App.tsx` is a coordinator; privileged behavior remains at the
  Tauri invoke seam.
- `docs/architecture/team-scalability.md`: Phase 2 extracts one App domain hook
  at a time with focused tests.
- `docs/architecture/phase-1-boundaries.md`: workspace restoration and
  persistence synchronization are the first named extraction seam.
- `src/app/App.tsx`: current implementation and call sites.

## Scope

In scope:

- Extract the existing workspace selection/restoration branch into a hook under
  `src/app/lib/`, with dependencies injected as a narrow interface.
- Extract the existing terminal/canvas workspace-layout persistence operations
  into a separate hook or pure helpers under `src/app/lib/`.
- Preserve workspace state ownership in `App.tsx` and tab/pane ownership in
  `useTabs`; preserve `db_list_panes` and `db_save_workspace` contracts.
- Add focused tests that prove the extracted module interfaces select existing
  tabs, restore persisted layouts, and persist unchanged layout shapes.

Out of scope:

- Changing workspace schema, Tauri/Rust commands, or canvas/terminal PTY
  lifecycle.
- Moving unrelated workspace creation, deletion, rename, reorder, or UI
  rendering behavior.
- Combining this with any visual or formatting cleanup.

## Approach

1. Lock the workspace selection/restoration branch behind an injected hook
   interface; retain existing normal/canvas fallback paths verbatim.
2. Isolate layout serialization, workspace record update, React state update,
   and `db_save_workspace` persistence in a small persistence module.
3. Make `App.tsx` compose both hooks and pass existing callbacks/state through,
   leaving it as application wiring.
4. Run focused tests for both hooks plus existing App, terminal, and canvas
   boundary proof; then run typecheck and build.

## Risks And Recovery

- Canvas and standard workspace restoration have distinct lifecycles. Preserve
  their separate code paths and only share injected helpers.
- Async pane loading can complete after a newer selection. Phase 2 must not
  alter existing ordering or fallback behavior.
- Recovery: revert the new hook modules and restore the moved App callbacks;
  no persistence migration or process state is involved.

## Progress

- [x] Write and run failing focused tests for workspace selection/restoration.
- [x] Extract selection/restoration hook and wire it from `App.tsx`.
- [x] Write and run failing focused tests for layout persistence.
- [x] Extract layout persistence hook and wire it from `App.tsx`.
- [x] Run boundary tests, typecheck, and build.

## Decisions

- 2026-08-11: Phase 2 is limited to one App seam and its persistence partner;
  terminal and canvas modules remain untouched.
- 2026-08-11: Hook dependencies are injected rather than importing `App.tsx`
  state, so their interfaces are independently testable.
- 2026-08-11: Layout persistence is split into a pure record-transform module
  plus a React/Tauri adapter so App preserves callback ordering while the
  persistence logic stays unit-testable without React.

## Validation

- Focused proof: new hook tests plus `src/app/App.test.ts`,
  `src/modules/terminal/TerminalStack.source.test.ts`, and
  `src/modules/architecture/canvasWorkspacePersistence.test.ts`.
- Repository checks: `pnpm exec tsc --noEmit` and `pnpm build`.

## Result

Implemented on 2026-08-11 with these module seams:

- `src/app/lib/useWorkspaceSelection.ts` — injected workspace
  selection/restoration seam covering standard-tab activation, persisted canvas
  restore, and `db_list_panes` fallback behavior.
- `src/app/lib/workspaceLayoutPersistence.ts` — pure workspace record
  transformation helpers for standard terminal pane trees and canvas diagrams.
- `src/app/lib/useWorkspacePersistence.ts` — App-facing adapter that preserves
  `setTerminalPaneTree` / `updateTab` ordering and delegates record updates to
  the pure persistence helpers.

Validation run on 2026-08-11:

- `pnpm vitest run src/app/lib/useWorkspaceSelection.test.ts`
  - RED before implementation: missing module
  - GREEN after implementation: 3/3 tests passed
- `pnpm vitest run src/app/lib/workspaceLayoutPersistence.test.ts`
  - RED before implementation: missing module
  - GREEN after implementation: 4/4 tests passed
- `pnpm vitest run src/app/lib/useWorkspacePersistence.test.ts`
  - RED before implementation: missing module
  - GREEN after implementation: 3/3 tests passed
- `pnpm vitest run src/app/lib/useWorkspaceSelection.test.ts src/app/lib/workspaceLayoutPersistence.test.ts src/app/lib/useWorkspacePersistence.test.ts src/app/App.test.ts src/modules/terminal/TerminalStack.source.test.ts src/modules/architecture/canvasWorkspacePersistence.test.ts`
  - GREEN: 47/47 tests passed
- `pnpm exec tsc --noEmit --pretty false`
  - GREEN
- `pnpm build`
  - GREEN

Limitations / follow-up:

- A temporary type mismatch surfaced between the extracted selection-pane shape
  and `newWorkspaceTab`'s saved-pane contract; the seam now matches the full
  saved-pane shape (`paneIndex`, `workingFolder`, `lastCommand`, `autoLaunch`).
- The next extraction seam remains `TerminalStack.tsx` pane rendering versus
  live PTY lifecycle, as documented in Phase 1 boundaries.
