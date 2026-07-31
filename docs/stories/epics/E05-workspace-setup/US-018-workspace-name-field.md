# US-018 Workspace Name Field

## Status

implemented

## Lane

normal

## Product Contract

Workspace setup lets users name and color the workspace before opening it. The
field is prefilled with the next generated workspace name and is used for both
regular workspace launch and agent CLI launch.

## Relevant Product Docs

- `docs/product/workspace-setup.md`

## Acceptance Criteria

- The inline setup view shows a Workspace name input with a color picker before
  Working folder.
- The name defaults to the next available generated workspace name.
- Leaving the name blank falls back to the generated name.
- The color defaults to the next generated workspace color.
- Selecting a recent workspace fills the setup name, color, folder, and terminal
  count from that recent item.
- Opening without AI and launching with agents both create the workspace with
  the chosen name and color.

## Design Notes

- Commands: none.
- Queries: none.
- API: `WorkspaceSetupView` passes optional workspace name and color values to
  workspace creation.
- Tables: no database changes; existing workspace `name` persistence is reused.
- Domain rules: user-provided names are trimmed; blank names use the generated
  fallback. Workspace colors are normalized to the supported accent palette and
  fall back to the generated color.
- UI surfaces: inline workspace setup view.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer       | Expected proof                                            |
| ----------- | --------------------------------------------------------- |
| Unit        | WorkspacesPanel source regression test                    |
| Integration | Typecheck and full Vitest suite                           |
| E2E         | Not required for this setup flow                          |
| Platform    | Not required                                              |
| Release     | Manual workspace setup smoke with a custom workspace name |

## Harness Delta

None.

## Evidence

2026-07-05:

- `./node_modules/.bin/vitest run src/modules/workspaces/WorkspacesPanel.test.ts src/app/App.test.ts`
  passed with 2 files and 11 tests after adding the workspace setup color
  picker.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 26 files and 128 tests.
- `scripts/bin/harness-cli story verify US-018` passed with 2 files and 11
  tests.
