# Terminal Agent Switcher

## Goal

Let users replace the coding CLI running in an existing terminal pane by clicking the agent logo in that pane's header. The switch must stay within the same pane and preserve its current working directory and worktree.

## Interaction

- The current agent logo in `FloatingTerminalOverlay` becomes a menu trigger.
- The menu contains only CLI agents that are configured and enabled in Settings.
- A final `Terminal` item switches the pane back to a plain interactive shell.
- The current selection is marked with a check.
- Selecting the current item is a no-op.
- Selecting another item closes the current PTY session and respawns the same leaf in its existing cwd.
- The pane retains focus after the switch.

## Agent Commands

The switcher resolves each enabled agent through the existing CLI catalog and Settings overrides:

1. `agentLaunchCommands[agent.id]` when configured.
2. The catalog definition's `launch` command.
3. The catalog definition's bare `command` value.

The `Terminal` item launches no initial command.

## State and Persistence

- The active pane's `lastCommand` and `autoLaunch` state are updated before the PTY is respawned.
- Workspace panes persist the selected command through the existing `db_save_pane` path.
- Standalone terminal tabs keep the selection for their current in-memory lifetime.
- Switching does not create a tab, split, pane, or worktree.

## Error Handling

- PTY replacement uses the existing `respawnSession` lifecycle rather than writing `exit` and a new command into the old process.
- If an agent command cannot start, the PTY remains an interactive shell so the pane is still usable.
- Disabled agents disappear from the menu when Settings change.

## Accessibility and Visual Behavior

- The icon trigger has an accessible label naming the current agent or `Terminal`.
- Each menu item contains the existing `AgentCliIcon`, a text label, and a check for the current selection.
- The `Terminal` item uses the existing terminal icon.
- Keyboard navigation and Escape dismissal come from the existing dropdown primitives.

## Validation

- Unit/source coverage verifies enabled-agent filtering, Settings command precedence, current-selection marking, and the Terminal fallback.
- A focused interaction test verifies that selecting an agent updates the leaf launch state and requests a same-leaf respawn.
- Typecheck and production build remain green.
