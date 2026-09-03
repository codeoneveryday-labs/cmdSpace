# Command Code: Comprehensive Documentation & Reference Guide

> Source: [Command Code Official Documentation](https://commandcode.ai/docs)  
> Compiled from official docs: Overview, Quickstart, Interactive Mode, Permissions, Plan Mode, Goal, Slash Commands, CLI Reference, Models, and Taste Learning.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Supported Platforms & Installation](#2-supported-platforms--installation)
3. [Interactive Session & Keyboard Controls](#3-interactive-session--keyboard-controls)
4. [Permission System & Approval Modes](#4-permission-system--approval-modes)
5. [Complete Slash Commands Reference](#5-complete-slash-commands-reference)
6. [Models, Providers & Reasoning Effort](#6-models-providers--reasoning-effort)
7. [Configuration & Settings (`settings.json`)](#7-configuration--settings-settingsjson)
8. [Project Guidance & Instructions (`AGENTS.md`)](#8-project-guidance--instructions-agentsmd)
9. [Extensibility: Taste Learning, Skills, MCP, Mods & Hooks](#9-extensibility-taste-learning-skills-mcp-mods--hooks)
10. [Automation, Review, Worktrees & Headless Mode](#10-automation-review-worktrees--headless-mode)
11. [Context Window Monitoring & Calculation (`% Context`)](COMMAND_CODE_CONTEXT_WINDOW.md)

---

## 1. Overview & Architecture

**Command Code** (`cmd` / `command-code`) is an agentic coding assistant engineered to build full-stack projects, fix bugs, write tests, and refactor codebases while continuously adapting to developer coding style ("taste").

### Core Principles
- **Taste Learning Engine (`taste-1`)**: Applies meta neuro-symbolic AI with continuous reinforcement learning to align model outputs with user-specific coding conventions and design preferences.
- **Universal Model Compatibility**: Native support for frontier and open models across providers (Claude, GPT, DeepSeek, Kimi, Qwen, GLM, MiniMax).
- **Interactive Feed UI**: Live status line displaying active tool executions (`READ`, `EDIT`, `BASH`), context usage, active model, and permission mode.
- **Fail-Safe Checkpoints**: Built-in session state management supporting instantaneous undo/rewind to prior checkpoints.

---

## 2. Supported Platforms & Installation

### Requirements
- **Node.js**: Requires Node.js 22 (LTS) or newer. Will refuse to start on Node 20 and below.

### Installation via npm
```bash
# Global installation
npm i -g command-code@latest

# Verify installation
cmd --version
```

### CLI Command Aliases by Platform
| Environment | Primary Alias | Full Command |
| :--- | :--- | :--- |
| **macOS, Linux, WSL** | `cmd` | `command-code` |
| **Native Windows** (PowerShell, CMD, Windows Terminal) | `cmdc` | `command-code` |

*(Note: On native Windows, `cmd` is reserved by the OS shell, hence the `cmdc` alias).*

### Authentication
```bash
# Authenticate interactive session via browser
cmd login

# Log out
cmd logout
```

---

## 3. Interactive Session & Keyboard Controls

The interactive terminal feed displays real-time agent tool use and session state:
```text
┌────────────────────────────────┐
│ READ  src/auth.ts              │ ← Activity Feed
│ EDIT  src/auth.ts  +12 -3      │
│ BASH  pnpm test                │
│                                │
│ ✓ Added the retry guard.       │ ← Model Reply
├────────────────────────────────┤
│ TODOS  2/4                     │ ← Task List (Ctrl+X)
├────────────────────────────────┤
│ > fix the login redirect       │ ← User Input Composer
├────────────────────────────────┤
│ In auth.ts   opus-5   default  │ ← File · Model · Mode
└────────────────────────────────┘
```

### Input Prefix Characters
- `/` at the start: Opens the slash command palette.
- `!` at the start: Runs the line as a shell command (Bash mode) and feeds output into session context.
- `@` anywhere: Triggers file-path autocomplete and attaches file content to context.

### Essential Keyboard Shortcuts
| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Shift+Tab` | Cycle Permission Mode | Cycles `default` → `auto-accept` → `plan` → `default` (also includes `bypass` when launched with `--yolo`). |
| `Esc` | Stop Execution | Interrupts and halts active turn or command execution. |
| `Esc Esc` | Rewind | Instantly restores session state to the previous checkpoint (equivalent to `/rewind`). |
| `Ctrl+O` | Toggle Tool Output | Shows or hides full raw tool execution outputs. |
| `Ctrl+G` | Open External Editor | Opens the current composer prompt in `$EDITOR`. |
| `Ctrl+X` | Manage Todos | Toggles interactive todo management (`c` completes, `x` removes, `a` clears). |

---

## 4. Permission System & Approval Modes

Command Code routes every tool action (shell execution, file edit, web request, MCP call) through a centralized permission evaluation engine: **Allow, Ask, or Deny**.

### Permission Modes
| Mode | How to Switch | Behavior |
| :--- | :--- | :--- |
| **`default`** | `/mode:default` or `Shift+Tab` | Prompts before any modifying action (edits, shell commands). File reads and inspection tools are free. |
| **`auto-accept`** | `/mode:auto-accept` or `Shift+Tab` or `--auto-accept` | Executes normal file edits and safe file commands automatically without prompting. |
| **`plan`** | `/mode:plan` or `Shift+Tab` or `--plan` | Read-only mode. Explores codebase and formulates plans; only plan files may be modified. |
| **`bypass` (`yolo`)** | `--yolo` / `--dangerously-skip-permissions` | Bypasses all confirmation prompts. *Only selectable at launch to prevent model self-elevation.* |
| **`dont-ask`** | `"defaultMode": "dont-ask"` or `--permission-mode dont-ask` | Never asks interactively. Executes pre-approved actions and denies all others (CI/CD mode). |

---

## 5. Complete Slash Commands Reference

Type `/` at the start of the input line to open the interactive autocomplete menu.

### Modes & Planning
| Slash Command | Purpose & Description |
| :--- | :--- |
| `/mode [default\|auto-accept\|plan]` | Show or switch the permission mode. Bare `/mode` prints current mode. |
| `/mode:default` | Switch immediately to default permission mode. |
| `/mode:auto-accept` | Switch immediately to auto-accept mode. |
| `/mode:plan` | Switch immediately to plan mode. |
| `/plan [task]` | Enter plan mode and optionally begin planning specified task. |
| `/plans [name]` | Browse, review, and annotate saved project plans. |
| `/plan-review` | Open the session's latest plan in dedicated review view. |
| `/goal <objective>\|clear\|status` | Set, track, or clear autonomous multi-turn goal execution loop. |
| `/todos` | Manage the interactive todo list (`Ctrl+X`). |
| `/review [pr-number]` | Run an automated review on a pull request or local changes. |
| `/pr-comments` | Fetch all PR review comments for the current branch. |

### Sessions & Navigation
| Slash Command | Purpose & Description |
| :--- | :--- |
| `/clear` (alias `/new`) | Start a new session with clean context; prior session remains resumable. |
| `/resume` (alias `/sessions`) | Browse and resume previous conversations. |
| `/rename [name]` (alias `/name`) | Rename the active session. |
| `/fork [name]` | Fork the current conversation into an isolated branch. |
| `/clone` | Clone current branch into a new session and switch to it. |
| `/tree` | Browse session checkpoint tree and jump to any historical point. |
| `/rewind` | Restore session to previous checkpoint (`Esc Esc`). |
| `/export [html\|jsonl\|md]` | Export conversation history to file (HTML by default). |
| `/share [gist]` | Share session link or publish as a secret GitHub gist. |
| `/exit` (alias `/quit`) | Exit the Command Code CLI session. |
| `/reload` | Restart Command Code and restore session (applies updates). |

### Models & Providers
| Slash Command | Purpose & Description |
| :--- | :--- |
| `/model [id]` | Switch active model; bare `/model` opens interactive model picker. |
| `/effort [level]` | Configure reasoning effort (`low`, `medium`, `high`) for supported models. |
| `/connect` | Connect to AI providers, BYOK accounts, or API keys. |
| `/login` | Authenticate with Command Code or connected provider. |
| `/logout` | Sign out from Command Code or provider accounts. |

### Context & Extensibility
| Slash Command | Purpose & Description |
| :--- | :--- |
| `/compact` | Compact active conversation history to recover context capacity. |
| `/context` | Display detailed breakdown of context window consumption. |
| `/memory` | Inspect and manage persistent project and user memory. |
| `/init` | Scaffold `AGENTS.md` guidelines for the current project. |
| `/taste` | Manage Taste learning preferences and packages. |
| `/learn-taste` | Extract taste patterns from previous Claude Code or Cursor sessions. |
| `/skills` | Browse and activate installed agent skills (`/skill:<name>`). |
| `/agents` | Manage multi-agent configurations. |
| `/mcp` | List and configure Model Context Protocol servers. |
| `/design [mode]` | Launch UI design partner: audit, build, and compose interfaces. |
| `/import [agent]` | Import configuration and history from Claude Code, Codex, Cursor, etc. |
| `/add-dir <directory>` | Add external directory path to active workspace context. |
| `/worktree [name\|list]` | Manage isolated Git worktrees for concurrent branch tasks. |

### Utilities & Billing
| Slash Command | Purpose & Description |
| :--- | :--- |
| `/usage` | Display account credit balance, active plan, and usage statistics. |
| `/config [query]` | Search and update settings interactively. |
| `/theme [dark\|light\|auto]` | Switch theme (auto matches terminal background via OSC 11). |
| `/status` | Print complete diagnostics on environment, session, and tool status. |
| `/copy` | Copy the latest assistant response directly to clipboard. |
| `/feedback` (alias `/issue`) | File a prefilled bug report or feature request on GitHub. |
| `/update` | Update Command Code package to the latest release. |

---

## 6. Models, Providers & Reasoning Effort

Command Code supports frontier proprietary and open-source models through first-party routing or BYOK (Bring Your Own Key):

### Model Selection (`/model`)
- **Anthropic**: Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude Opus.
- **OpenAI**: GPT-4o, GPT-4o-mini, o1, o3-mini.
- **Open / Asian Frontier**: DeepSeek-V3, DeepSeek-R1, Qwen 2.5 Coder, Kimi, MiniMax, GLM-4.

### Reasoning Effort (`/effort`)
For reasoning models (such as `o1`, `o3-mini`, `deepseek-r1`):
```bash
/effort low
/effort medium
/effort high
```

---

## 7. Configuration & Settings (`settings.json`)

Settings are loaded hierarchically from project-level and global user configuration files.

### Configuration Paths
1. **Project Settings**: `.commandcode/settings.json`
2. **User Global Settings**: `~/.commandcode/settings.json`

### Example Configuration (`settings.json`)
```json
{
  "model": "claude-3-7-sonnet",
  "theme": "auto",
  "permissions": {
    "defaultMode": "default",
    "allow": [
      "pnpm test",
      "pnpm lint",
      "git status",
      "git diff"
    ],
    "deny": [
      "rm -rf *",
      "git reset --hard",
      "git push --force"
    ]
  },
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

---

## 8. Project Guidance & Instructions (`AGENTS.md`)

Command Code automatically reads instructions from `AGENTS.md` located in the repository root or subdirectory contexts.

### Initializing Project Instructions
```bash
# In an interactive session
/init
```
Scaffolds an `AGENTS.md` file tailored to the detected repository language, framework, test suite, and style conventions.

---

## 9. Extensibility: Taste Learning, Skills, MCP, Mods & Hooks

### Taste Learning (`/taste`)
Command Code captures stylistic feedback during code edits:
- Extracts coding idioms, variable naming styles, test structure, and architectural preferences.
- Import historical style from prior agents with `/learn-taste`.

### Skills (`/skills`)
Place custom skills under `.commandcode/skills/` or `~/.commandcode/skills/`:
- Invocable as `/<skill-name>` or directly targeted via `/skill:<name>`.

### Custom Slash Commands
Save markdown prompt templates under `.commandcode/commands/` or `~/.commandcode/commands/`:
```bash
mkdir -p .commandcode/commands
echo 'Refactor $1 to improve performance and add benchmarks: $@' > .commandcode/commands/optimize.md
# Invoked via: /optimize src/query.ts
```

### Lifecycle Hooks (`/hooks`)
Support for deterministic lifecycle interception:
- `PreToolUse`: Validate or reject tool calls before execution.
- `PostToolUse`: Validate file edits or trigger linters/formatters after modification.

---

## 10. Automation, Review, Worktrees & Headless Mode

### Headless / Print Mode (`-p`, `--print`)
Run non-interactive agent tasks for CI/CD pipelines or scripting:
```bash
cmd -p "Run test suite and report any failing test cases" --max-turns 30
```

### Isolated Git Worktrees (`/worktree`)
Run experimental or branch-isolated tasks without altering your working directory:
```bash
cmd -w spike-feature "Prototype authentication with Clerk"
```

### Autonomous Goal Tracking (`/goal`)
Run an autonomous development loop targeted toward a complex milestone:
```bash
/goal Implement end-to-end stripe webhook verification with full unit tests
```
Codex/Claude/Command Code monitors progress turn-by-turn until the objective is accomplished or the turn cap is reached.
