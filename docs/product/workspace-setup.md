# Workspace Setup

The workspace setup view lets users choose the working folder and terminal
layout before opening a workspace. It opens inline inside the main workspace
surface, replacing the active terminal/editor content until the user goes back
or opens a workspace.

## Working Folder

Users can set the workspace name before choosing the folder. The setup view
prefills the next available `workspace-XX` name; if the field is left blank, the
workspace falls back to that generated name. The same row includes the workspace
color picker, and the selected color is used for the new workspace. Selecting a
recent workspace fills the name, color, folder, and terminal count from that
recent item.

Users can choose a working folder with the native folder picker. The selected
folder is shown in the read-only working-folder field.

Below the picker, the setup view provides a terminal-style command input for quick
folder changes. It accepts `cd` commands only:

- `cd folder-name` resolves relative to the currently selected working folder.
- `cd ..` moves to the parent folder.
- `cd ~/folder-name` resolves from the inferred user home when available.
- Quoted paths are accepted for folder names that include spaces.

The command input applies on Enter or with its arrow button. It updates the
selected working folder but does not execute arbitrary shell commands.

The setup view also shows up to six recent workspaces below the command input. These
recents are stored separately from the currently open workspace list, so deleting
an open workspace does not remove it from recent history. Each recent item
displays the workspace name, compact folder path, and terminal count. Selecting a
recent item fills the working folder and restores its terminal count for the new
workspace setup.

## Presets

Below recents, the setup view shows built-in workspace presets for common
terminal layouts. A preset changes only the terminal count; it keeps the selected
working folder unchanged. Users can still fine-tune the terminal count with the
layout tiles after choosing a preset.

## Workspace Mode

The setup view defaults to a Standard workspace. Users can instead choose a
Canvas workspace. Both modes use the same working folder, terminal count, and
agent CLI assignment. Canvas mode places those independent shell terminals
directly on a named canvas rather than opening a separate terminal-pane tab.
It recreates that canvas tab when the saved workspace is opened after an app
restart. Existing workspaces without a stored mode remain Standard workspaces.

## Terminal Layout

Users choose a terminal count from the predefined layout tiles. Opening without
AI starts the workspace with the selected folder and terminal count.

## Agent CLI Launch

After choosing the folder and terminal layout, users can continue to an agent
CLI step. The built-in choices are intentionally limited to:

- Claude Code
- Codex
- OpenCode
- Gemini CLI

Users can assign one or more terminals to each agent. Assigned terminals launch
the agent command automatically when the workspace opens; unassigned terminals
remain regular shells. Built-in agents start the installed CLI directly. Users
can also add a custom command, which runs exactly as entered and does not install
anything automatically.

Claude Code launches with `--dangerously-skip-permissions`, Codex launches with
`--dangerously-bypass-approvals-and-sandbox`, and OpenCode launches with
`--auto`. These commands are seeded directly into the terminal panes, so opening
a workspace does not print shell bootstrap, package installation, prompt
automation, config mutation, or Git worktree setup commands.

Skipping this step keeps the workspace as regular terminals.

## Validation

Source tests protect the inline setup view structure and quick folder command
parser. They also protect the limited agent CLI list and the pane launch seed
used to start selected agents.
