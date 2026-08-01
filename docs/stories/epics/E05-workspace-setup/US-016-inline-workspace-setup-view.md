# US-016 Inline Workspace Setup View

## Status

implemented

## Lane

normal

## Product Contract

Workspace setup opens as an inline view inside the main workspace surface instead
of a blocking modal popup. The sidebar workspace list stays visible, and the
setup flow no longer depends on overlay stacking above the native browser pane.

## Relevant Product Docs

- `docs/product/workspace-setup.md`
- `docs/product/shell-overlays.md`

## Acceptance Criteria

- Clicking New workspace in the workspace sidebar opens setup inside the main
  workspace surface.
- The setup view preserves working-folder selection, `cd` command input,
  recents, presets, terminal-count tiles, Back, Open without AI, and Next
  actions.
- Presets appear below recents and change only the terminal count.
- Selecting an existing workspace leaves the setup view and focuses that
  workspace.
- Opening without AI creates the workspace and returns to the normal workspace
  surface.
- Workspace setup no longer renders with the shared dialog overlay components.

## Design Notes

- Commands: none.
- Queries: none.
- API: no backend API changes.
- Tables: no database changes.
- Domain rules: recent workspace history and terminal-count restoration keep
  the existing SQLite-backed behavior. Presets are built-in layout shortcuts and
  do not change the selected working folder.
- UI surfaces: workspace sidebar new button, main workspace surface, workspace
  setup view.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | WorkspacesPanel source regression test |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for this UI refactor |
| Platform | Not required; manual smoke can verify native browser no longer overlays setup |
| Release | Manual new-workspace smoke with sidebar browser open |

## Harness Delta

None.

## Evidence

2026-07-04:
- `./node_modules/.bin/vitest run src/modules/workspaces/WorkspacesPanel.test.ts src/app/App.test.ts`
  passed with 2 files and 11 tests.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 26 files and 128 tests.
- `scripts/bin/harness-cli story verify US-016` passed with 2 files and 11
  tests.

2026-07-05:
- `./node_modules/.bin/vitest run src/modules/workspaces/WorkspacesPanel.test.ts src/app/App.test.ts`
  passed with 2 files and 11 tests after removing the old card-like setup
  wrapper.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 26 files and 128 tests.

2026-07-05:
- `./node_modules/.bin/vitest run src/modules/workspaces/WorkspacesPanel.test.ts src/app/App.test.ts`
  passed with 2 files and 11 tests after adding setup presets.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 26 files and 128 tests.
