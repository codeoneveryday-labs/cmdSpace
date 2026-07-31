# US-017 Agent CLI Launcher

## Status

implemented

## Lane

normal

## Product Contract

Workspace setup includes an agent CLI step after the folder and terminal layout
step. Users can assign selected terminal panes to AI coding CLIs before opening
the workspace.

## Relevant Product Docs

- `docs/product/workspace-setup.md`

## Acceptance Criteria

- The setup flow offers only Claude Code, Codex, OpenCode, Gemini CLI, and one
  Custom command option.
- The agent step lets users assign zero or more terminals to each built-in
  agent without exceeding the selected terminal count.
- Built-in agent terminals start the installed CLI directly without package
  installation or shell bootstrap.
- Claude Code starts with permission-bypass mode enabled, Codex starts with all
  approval and sandbox prompts bypassed, and OpenCode starts in auto-approve
  mode.
- Agent startup does not run `expect`, mutate config files, or create Git
  worktrees before starting the interactive CLI.
- Custom command terminals run the user-entered command as-is and do not install
  anything automatically.
- Users can skip the agent step and open regular terminals.
- The selected agent commands are seeded into the terminal pane layout when the
  workspace opens.

## Design Notes

- Commands: no new backend commands; uses existing terminal `initialCommand`
  launch path.
- Queries: none.
- API: `WorkspaceSetupView` can pass optional initial commands to workspace
  creation.
- Tables: no schema changes; existing pane persistence stores seeded
  `lastCommand` values.
- Domain rules: agent assignments cannot exceed the selected terminal count.
  Agent startup is limited to the selected CLI command and its permission
  bypass flag so the terminal pane remains clean and predictable.
- UI surfaces: inline workspace setup view.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer       | Expected proof                                                              |
| ----------- | --------------------------------------------------------------------------- |
| Unit        | WorkspacesPanel source regression test                                      |
| Integration | Typecheck and full Vitest suite                                             |
| E2E         | Not required for this setup flow                                            |
| Platform    | Manual smoke can verify direct CLI launch behavior                          |
| Release     | Manual workspace setup smoke with one built-in agent and one custom command |

## Harness Delta

None.

## Evidence

2026-07-05:

- `./node_modules/.bin/vitest run src/modules/workspaces/WorkspacesPanel.test.ts src/app/App.test.ts`
  passed with 2 files and 11 tests after adding startup prompt automation for
  Claude Code and Codex plus a runtime Codex trust override for the working
  directory.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 26 files and 128 tests.
- `scripts/bin/harness-cli story verify US-017` passed with 2 files and 11
  tests.
- `expect -c '... spawn codex -c "projects.\"$env(PWD)\".trust_level=\"trusted\"" --help ...'`
  parsed the Codex trust override successfully.
- The launcher now persists `[projects."<cwd>"] trust_level = "trusted"` to
  `~/.codex/config.toml` before starting Codex because the interactive trust
  gate is not reliably bypassed by config override alone.
- Added the current manual smoke folder
  `/Users/0xboji/devops/k8s-self-healing-platform` to `~/.codex/config.toml` so
  new Codex panes for that workspace no longer show the trust prompt.
