# Claude Code: Comprehensive Documentation & Reference Guide

> Source: [Claude Code Official Documentation (Anthropic)](https://code.claude.com/docs/en/overview)  
> Compiled from official docs: Overview, Core Concepts, Commands, Permission Modes, Fast Mode, Configuration, and Interactive Interface.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Supported Platforms & Installation](#2-supported-platforms--installation)
3. [Interactive Session & Keyboard Controls](#3-interactive-session--keyboard-controls)
4. [Permission System & Approval Modes](#4-permission-system--approval-modes)
5. [Complete Slash Commands Reference](#5-complete-slash-commands-reference)
6. [Configuration & Settings (`settings.json`)](#6-configuration--settings-settingsjson)
7. [Memory, `CLAUDE.md`, and Context Management](#7-memory-claudemd-and-context-management)
8. [Subagents, Workflows & Parallel Execution](#8-subagents-workflows--parallel-execution)
9. [MCP (Model Context Protocol) & Tool Integrations](#9-mcp-model-context-protocol--tool-integrations)
10. [Automation: Hooks, Routines & Goals](#10-automation-hooks-routines--goals)
11. [Context Window Monitoring & Calculation (`% Context`)](CLAUDE_CONTEXT_WINDOW.md)

---

## 1. Overview & Architecture

**Claude Code** is Anthropic's agentic coding tool that reads codebases, edits files across multiple directories, runs terminal commands, and integrates with developer tools.

### Core Principles
- **Agentic Loop**: Claude investigates the codebase, gathers context with specialized tools (`Read`, `Glob`, `Grep`), reasons about the plan, executes edits, and runs tests/commands to verify results.
- **Fail-Closed Permissions**: By default, any operation that alters state (writes, command execution, network access) is subject to approval rules or classifier verification.
- **Prompt Caching**: Claude Code utilizes automatic prompt caching to ensure that large system prompts, `CLAUDE.md` memory files, and codebase indexes do not incur full token costs on repetitive turns.

---

## 2. Supported Platforms & Installation

Claude Code runs across multiple surfaces sharing the same underlying engine, settings, and MCP tools:

### Surfaces
1. **Terminal (CLI)**: Full interactive terminal environment.
2. **VS Code & Cursor**: Extension with inline diffs, plan review, @-mentions.
3. **JetBrains IDEs**: IntelliJ, PyCharm, WebStorm plugin.
4. **Desktop App**: Standalone macOS / Windows / Linux app with multi-session tabs, visual diff review, and phone dispatch.
5. **Web (`claude.ai/code`)**: Cloud-hosted execution without local machine dependencies.
6. **Mobile (iOS & Android)**: Remote control and task monitoring via the Claude app.

### CLI Installation

- **macOS / Linux / WSL (Native script)**:
  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```
- **Homebrew (macOS)**:
  ```bash
  brew install --cask claude-code
  # Or track the latest edge channel:
  brew install --cask claude-code@latest
  ```
- **Windows (PowerShell)**:
  ```powershell
  irm https://claude.ai/install.ps1 | iex
  ```
- **Windows (Winget)**:
  ```powershell
  winget install Anthropic.ClaudeCode
  ```

---

## 3. Interactive Session & Keyboard Controls

When running `claude` interactively in a terminal, the interface supports specialized keyboard shortcuts:

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Shift + Tab` | **Cycle Permission Modes** | Cycles between `auto` → `manual (default)` → `acceptEdits` → `plan` → `bypassPermissions`. |
| `Enter` | **Submit** | Submits the current prompt or confirms a dialog selection. |
| `Shift + Enter` | **Newline** | Inserts a newline without submitting the message. |
| `Esc` | **Cancel / Back** | Dismisses pickers, cancels execution, or returns to prompt. |
| `Ctrl + C` | **Interrupt** | Halts current agent generation or active tool command. |
| `Ctrl + D` | **Exit** | Exits the Claude Code session. |
| `Tab` | **Autocomplete** | Autocompletes file paths, commands, and options. |

---

## 4. Permission System & Approval Modes

Claude Code operates with two distinct permission layers: **Permission Modes** (session-wide operational posture) and **Permission Rules** (granular allow/ask/deny rules).

### Available Permission Modes

| Mode | CLI Label | Behavior | Best Used For |
| :--- | :--- | :--- | :--- |
| `default` | **Manual** | Prompts for confirmation before file edits, shell commands, or network requests. Only reads run freely. | Sensitive codebases, careful line-by-line review. |
| `acceptEdits` | **Accept Edits** | Automatically approves file edits and standard file operations (`mkdir`, `touch`, `mv`, `cp`). Shell commands still prompt. | Interactive feature coding and refactoring. |
| `plan` | **Plan Mode** | Read-only mode. Claude investigates and drafts plans but is prevented from modifying files or running modifying commands. | Exploration, planning large tasks before execution. |
| `auto` | **Auto Mode** | Autonomous mode where a secondary safety classifier reviews and approves operations without interrupting the user. | Long-running workflows, prompt fatigue reduction. |
| `dontAsk` | **Don't Ask** | Strictly allows ONLY pre-approved tools defined in allowlists; denies anything else without prompting. | Headless CI/CD pipelines and scripts. |
| `bypassPermissions` | **Bypass** | Bypasses all safety checks and prompts. | Strictly for disposable Docker containers and sandboxed VMs. |

### How to Switch Permission Modes
1. **Interactive Key**: Press `Shift + Tab` in the terminal to cycle modes on the fly.
2. **Launch Flags**:
   - `claude --permission-mode default` (Manual)
   - `claude --permission-mode auto`
   - `claude --permission-mode plan`
   - `claude --permission-mode dontAsk`
   - `claude --dangerously-skip-permissions` (Bypass)
3. **Interactive Commands**:
   - `/plan`: Directly switches session into Plan mode.
   - `/permissions`: Opens the interactive rule manager to add allow/ask/deny rules.

---

## 5. Complete Slash Commands Reference

Commands must be typed at the beginning of the prompt line.

### Core Session & Control Commands

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/permissions` | *None* | Opens interactive rule manager for tool permissions (allow, ask, deny rules, working directories). Alias: `/allowed-tools`. |
| `/config` | `[key=value ...]` | Opens the interactive settings panel (theme, model, output style) or sets options directly. Alias: `/settings`. |
| `/fast` | `[on\|off]` | Toggles Fast Mode on/off for lower latency responses. |
| `/plan` | `[description]` | Toggles Plan Mode or starts a plan for the provided task description. |
| `/model` | `[model]` | Switches active model (e.g. Sonnet, Opus) and adjusts reasoning effort. |
| `/effort` | `[level\|auto\|status]` | Sets reasoning effort: `low`, `medium`, `high`, `xhigh`, `max`, `ultracode`, or `auto`. |
| `/compact` | `[instructions]` | Summarizes conversation context to free up tokens. |
| `/context` | `[all]` | Visualizes current context window consumption and cache hit status. |
| `/clear` | `[name]` | Clears conversation context for a clean start. Aliases: `/reset`, `/new`. |
| `/resume` | `[session-id]` | Resumes an earlier session. |
| `/fork` | `[prompt]` | Copies current session into a new background session. |
| `/branch` | `[name]` | Branches current conversation to test an alternative direction. |
| `/diff` | *None* | Opens interactive viewer for uncommitted git changes and turn diffs. |
| `/review` | `[level] [--fix]` | Runs multi-agent code review on current diff or PR. Alias: `/code-review`. |
| `/doctor` | *None* | Runs diagnostic health checks on installations, `CLAUDE.md`, and plugins. Alias: `/checkup`. |
| `/mcp` | `[subcommand]` | Manages Model Context Protocol servers and connections. |
| `/memory` | *None* | Views and edits `CLAUDE.md` and auto memory entries. |
| `/btw` | `[question]` | Asks a side question without polluting session conversation history. |
| `/copy` | `[N]` | Copies response or code blocks to clipboard. |
| `/export` | `[filename]` | Exports session transcript to file. |
| `/goal` | `[condition\|clear]` | Sets a goal loop: Claude continues running until the condition is met. |
| `/loop` | `[interval] [prompt]` | Periodically executes a prompt on a schedule. Alias: `/proactive`. |
| `/background` | `[prompt]` | Detaches session into background agent view. Alias: `/bg`. |
| `/help` | *None* | Displays interactive help menu. |
| `/exit` | *None* | Terminates the CLI session. Alias: `/quit`. |

---

## 6. Configuration & Settings (`settings.json`)

### File Precedence Hierarchy
1. **Managed Settings**: Organization-level MDM policies (`/Library/Application Support/ClaudeCode/`).
2. **Local Project Settings**: `<project>/.claude/settings.local.json` (developer-specific, gitignored).
3. **Project Settings**: `<project>/.claude/settings.json` (checked into git).
4. **User Settings**: `~/.claude/settings.json` (global across user's machine).

### Example Configuration (`.claude/settings.json`)

```json
{
  "permissions": {
    "defaultMode": "default",
    "allowedTools": [
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(npm test)",
      "Read"
    ],
    "askTools": [
      "Bash(git push *)",
      "Bash(rm *)"
    ],
    "denyTools": [
      "Bash(curl * | bash)"
    ]
  },
  "model": "claude-3-7-sonnet-20250219",
  "fastMode": true,
  "theme": "dark",
  "sandbox": {
    "enabled": true
  }
}
```

---

## 7. Memory, `CLAUDE.md`, and Context Management

### Persistent Memory: `CLAUDE.md`
- Placed in project root or subdirectories.
- Automatically injected into Claude's context at the start of every session.
- Should contain build commands, testing instructions, architectural invariants, code style, and critical conventions.

### Auto Memory
- Claude Code automatically extracts reusable learnings and records them under `~/.claude/memory/` and `<project>/.claude/memory/`.
- Managed via the `/memory` slash command.

### Context Window Optimization
- **Prompt Caching**: Claude Code caches system instructions and project context. Edits to `CLAUDE.md` take effect in subsequent turns.
- **Compaction**: `/compact` preserves summary points, active goals, and memory files while purging historical tool raw outputs.

---

## 8. Subagents, Workflows & Parallel Execution

### Subagents
- Claude can spawn specialized subagents for distinct tasks (e.g. `Research`, `Documentation`, `Debugger`).
- Subagents operate with their own scoped context and return synthesized summaries to the primary agent.

### Git Worktree Isolation
- When running parallel tasks or `/batch`, Claude Code isolates background agents inside dedicated git worktrees (`--worktree`) so edits do not collide on the working branch.

---

## 9. MCP (Model Context Protocol) & Tool Integrations

Claude Code acts as an MCP client, allowing bi-directional tool invocation:
- Add servers via `claude mcp add` or `/mcp`.
- Configuration stored in `.claude/mcp.json` (project) or `~/.claude/mcp.json` (global).
- Connects databases, issue trackers (Jira, GitHub, Linear), cloud consoles, and local dev tools directly into Claude's reasoning loop.

---

## 10. Automation: Hooks, Routines & Goals

### Lifecycle Hooks (`.claude/hooks/`)
Run deterministic scripts before or after agent actions:
- `PreToolUse`: Validates or blocks tool calls before execution.
- `PostToolUse`: Formats code (e.g. `prettier`, `black`) immediately after file edits.
- `Stop`: Runs tests or linters when the agent finishes a turn.

### Goals (`/goal`)
Enables autonomous goal tracking across multi-turn reasoning:
```bash
/goal "All unit tests in src/ pass and git status is clean"
```
Claude iterates, troubleshoots failures, and stops only when the goal criteria evaluate to true.
