# US-019 Canvas Workspace Mode

## Status

implemented

## Lane

normal

## Product Contract

Workspace setup offers Standard workspace and Canvas workspace modes. Standard
is the default. Canvas mode creates the same number of independent terminal
nodes, working folder, and agent CLI launch plan as Standard mode directly on
its canvas.

## Relevant Product Docs

- `docs/product/workspace-setup.md`
- `docs/product/architecture-canvas.md`

## Acceptance Criteria

- Standard workspace is selected by default.
- Canvas workspace creates exactly the selected number of terminal panes and
  applies the same agent commands as Standard workspace creation.
- Canvas workspace opens the selected number of terminal nodes on its canvas,
  with each node seeded with its working folder and assigned agent command.
- Canvas mode persists; reopening a saved Canvas workspace recreates its canvas
  tab when needed.
- Renaming or deleting a Canvas workspace also renames or closes its canvas tab.
- Existing stored workspaces without a mode remain Standard workspaces.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Workspace setup source regression test and Rust workspace DB test |
| Integration | Frontend typecheck and production build |
| E2E | Not required for this bounded desktop UI change |
| Platform | Manual smoke: create Canvas workspace with agents and reopen it |

## Evidence

2026-07-30:

- `cd src-tauri && cargo test modules::db::tests --lib` passed (2 tests).
- `./node_modules/.bin/vitest run src/modules/workspaces/WorkspacesPanel.test.ts src/app/App.test.ts` passed (18 tests).
- `pnpm build` passed.
- `cargo fmt --check` and `git diff --check` passed.
