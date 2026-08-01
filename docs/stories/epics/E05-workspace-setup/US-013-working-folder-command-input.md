# US-013 Working Folder Command Input

## Status

implemented

## Lane

normal

## Product Contract

The workspace setup dialog provides a terminal-style input below the working
folder picker so users can quickly change the selected folder with `cd` commands
before opening a workspace.

## Relevant Product Docs

- `docs/product/workspace-setup.md`

## Acceptance Criteria

- The setup dialog shows a command input directly below the working folder
  picker.
- The command input accepts `cd` commands and applies them on Enter or with an
  arrow button.
- Relative paths resolve from the currently selected working folder.
- Parent-folder navigation, home-folder shorthand, and quoted paths are handled.
- Non-`cd` commands are ignored and are not executed.
- Up to six recent workspaces appear below the command input.
- Selecting a recent workspace fills its folder and terminal count.
- Recent workspaces persist in SQLite separately from the open workspace list,
  so deleting open workspaces does not clear recent history.

## Design Notes

- Commands: no shell command is executed; the input only parses `cd`.
- Queries: none.
- API: adds Tauri DB commands for listing and saving recent workspaces.
- Tables: adds `recent_workspaces`.
- Domain rules: folder command parsing is client-side path resolution; terminal
  launch keeps existing backend cwd validation. Recent workspace selection uses
  dedicated SQLite history instead of the currently open workspace list.
- UI surfaces: workspace setup dialog.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | WorkspacesPanel source regression test |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for this narrow setup-dialog interaction |
| Platform | Not run; manual folder command smoke remains useful |
| Release | Manual workspace setup smoke with `cd`, `cd ..`, and quoted paths |

## Harness Delta

None.

## Evidence

2026-07-04:
- `./node_modules/.bin/vitest run src/modules/workspaces/WorkspacesPanel.test.ts`
  passed with 1 test.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 25 files and 127 tests.

2026-07-04:
- `./node_modules/.bin/vitest run src/modules/workspaces/WorkspacesPanel.test.ts`
  passed with 1 test after adding recent workspace shortcuts.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 25 files and 127 tests.

2026-07-04:
- `./node_modules/.bin/vitest run src/modules/workspaces/WorkspacesPanel.test.ts`
  passed with 1 test after moving Recents to persisted SQLite history.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 25 files and 127 tests.
- `cargo test db::tests` passed with 2 tests.
- `cargo test` passed with 56 Rust tests.
- `cargo clippy --all-targets --all-features --locked -- -D warnings` passed.
