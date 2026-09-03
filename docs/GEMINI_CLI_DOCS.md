# Gemini CLI: Comprehensive Documentation & Reference Guide

> Source: [Gemini CLI Official Documentation](https://geminicli.com/docs/)  
> Compiled from official docs: Overview, Installation, Authentication, CLI Cheatsheet, Keyboard Shortcuts, Built-in Commands, Plan Mode, Checkpointing, GEMINI.md, Extensions, Subagents, and Settings.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Supported Platforms & Installation](#2-supported-platforms--installation)
3. [Authentication Methods](#3-authentication-methods)
4. [Approval Modes & Permission Policy](#4-approval-modes--permission-policy)
5. [Complete Slash Commands Reference](#5-complete-slash-commands-reference)
6. [Interactive Session, Shortcuts & Input Prefixes](#6-interactive-session-shortcuts--input-prefixes)
7. [Plan Mode & Task Planning (`/plan`)](#7-plan-mode--task-planning-plan)
8. [Project Guidance & Context (`GEMINI.md`)](#8-project-guidance--context-geminimd)
9. [Extensibility: Extensions, Skills, MCP, Hooks & Subagents](#9-extensibility-extensions-skills-mcp-hooks--subagents)
10. [Automation, Checkpoints, Git Worktrees & Headless Mode](#10-automation-checkpoints-git-worktrees--headless-mode)
11. [Context Window Monitoring & Calculation (`% Context`)](GEMINI_CONTEXT_WINDOW.md)

---

## 1. Overview & Architecture

**Gemini CLI** (`gemini`) is an open-source, terminal-first AI coding agent developed by Google. Powered by the Gemini models (including Gemini 2.5 Pro and Gemini 3), it assists software engineers with full-stack development, automated debugging, test generation, codebase refactoring, and complex architectural planning directly from the command line.

### Core Architecture
- **Shadow Git Checkpointing**: Before modifying any project files, Gemini CLI automatically commits a snapshot to an isolated shadow Git repository (`~/.gemini/history/<project_hash>`) without touching your working repository's commit tree, enabling instantaneous zero-loss rollbacks via `/restore` or `/rewind`.
- **Multimodal & Large Context**: Natively supports massive context windows for whole-codebase comprehension, image/diagram ingestion, and text files.
- **Hierarchical Agent Context**: Automatically aggregates instructions from global (`~/.gemini/GEMINI.md`) and project-level (`GEMINI.md`) files.
- **Pluggable Architecture**: Native support for Extensions, Agent Skills, Subagents, Model Context Protocol (MCP) servers, and Pre/Post tool lifecycle hooks.

---

## 2. Supported Platforms & Installation

### System Requirements
- **Operating Systems**: macOS 15+, Windows 11 (24H2+), Ubuntu 20.04+ (Linux/WSL).
- **Runtime**: Node.js 20.0.0 or newer.
- **Hardware**: Minimum 4GB RAM (Casual), Recommended 16GB+ RAM (Large codebases).
- **Shell**: Bash, Zsh, or PowerShell.

### Installation Options

#### npm (Recommended)
```bash
npm install -g @google/gemini-cli

# Verify installation
gemini --version
```

#### Homebrew (macOS / Linux)
```bash
brew install gemini-cli
```

#### MacPorts (macOS)
```bash
sudo port install gemini-cli
```

#### Updating Gemini CLI
```bash
gemini update
```

---

## 3. Authentication Methods

Run `/auth` or configure via environment variables:

| Scenario / Account Type | Method | Google Cloud Project Required |
| :--- | :--- | :--- |
| **Personal Google Account** | Sign in with Google (OAuth in browser) | No |
| **Workspace / Organization** | Sign in with Google (OAuth) | Yes (Cloud project with Gemini API enabled) |
| **AI Studio User** | Gemini API Key (`GEMINI_API_KEY`) | No |
| **Google Cloud Vertex AI** | Vertex AI (`GOOGLE_GENAI_USE_VERTEXAI=true`) | Yes |
| **Headless / CI/CD** | Gemini API Key or Service Account Key | Optional |

To switch methods interactively:
```text
/auth
```

---

## 4. Approval Modes & Permission Policy

Gemini CLI evaluates every tool execution (file modification, shell command, network call, MCP execution) through its approval policy engine.

### Approval Modes (`--approval-mode`)
| Mode | CLI Flag | Interactive Shortcut | Description |
| :--- | :--- | :--- | :--- |
| **`default`** | `--approval-mode=default` | `Shift+Tab` | Standard mode: prompts for user confirmation before modifying files or executing potentially destructive commands. Free reads. |
| **`auto_edit`** | `--approval-mode=auto_edit` | `Shift+Tab` | Automatically accepts standard file edits; still prompts for shell executions. |
| **`plan`** | `--approval-mode=plan` | `Shift+Tab` or `/plan` | Read-only planning mode. Prohibits any file edits or side-effects, focusing purely on codebase research and plan generation. |
| **`yolo`** | `--approval-mode=yolo` | `--approval-mode=yolo` at launch | YOLO mode: auto-approves all tool and shell executions without user confirmation. |

### Folder Trust (`/permissions`)
Gemini CLI verifies directory trust on startup to prevent malicious execution in untrusted folders:
- `/permissions`: View folder trust status.
- `/permissions trust [<directory-path>]`: Explicitly grant trust to a workspace.
- `/policies list`: Inspect all active policies grouped by mode.

---

## 5. Complete Slash Commands Reference

Slash commands provide meta-level control over the CLI session:

### Core Session & Navigation
| Command | Description |
| :--- | :--- |
| `/chat` (alias `/resume`) | Open interactive session browser to list, resume, or export auto-saved chats. |
| `/clear` | Clear the active conversation history context and start a fresh turn. |
| `/rewind` | Step backward through conversation history and preview/revert file changes (`Esc Esc`). |
| `/restore [tool_call_id]` | Restore project files to their exact state prior to a tool call using shadow Git checkpoints. |
| `/compress` | Compress conversation context to free up token capacity. |
| `/copy` | Copy the most recent assistant response directly to system clipboard. |
| `/quit` (alias `/exit`) | Exit the CLI. Add `--delete` flag to wipe session history and temp files. |

### Modes & Planning
| Command | Description |
| :--- | :--- |
| `/plan [goal]` | Switch to Plan Mode (read-only) and view/formulate the implementation plan. |
| `/plan copy` | Copy the approved plan to the clipboard. |
| `/permissions` | Manage folder trust settings and execution permissions. |
| `/policies` | List active policy rules grouped by mode (`/policies list`). |
| `/settings` | Open interactive settings editor to inspect and modify `.gemini/settings.json`. |
| `/shells` (or `/bashes`) | Toggle background shells view to manage long-running terminal processes. |

### Environment, Tools & Extensibility
| Command | Description |
| :--- | :--- |
| `/model` | View or switch the active Gemini model (e.g., `gemini-2.5-pro`, `gemini-2.5-flash`). |
| `/tools [desc]` | Display all available tools registered to the model (file, shell, MCP, web). |
| `/memory` | Manage memory and context files (`/memory reload` reloads `GEMINI.md`). |
| `/skills` | Manage Agent Skills (`list`, `enable <name>`, `disable <name>`, `reload`). |
| `/agents` | Manage local and remote subagents (`list`, `enable`, `disable`, `reload`, `config`). |
| `/mcp` | Configure and reload Model Context Protocol servers (`/mcp reload`). |
| `/extensions` | Manage Gemini CLI extensions (`list`, `enable`, `disable`, `reload`). |
| `/hooks` | Manage PreToolUse and PostToolUse lifecycle hooks. |
| `/init` | Initialize or update `GEMINI.md` context file for the current project. |
| `/theme` | Open interactive theme selector dialog (Dark, Light, Auto). |
| `/vim` | Toggle Vim navigation mode (`NORMAL` and `INSERT` modes in the composer). |
| `/stats` | Display session token usage, tool invocation counts, and performance metrics. |
| `/editor` | Open current query in external text editor. |
| `/ide` | Inspect IDE companion connection status. |
| `/setup-github` | Set up GitHub Actions workflows to triage issues and review PRs with Gemini. |
| `/upgrade` | Open Code Assist subscription upgrade portal. |
| `/bug` | File an issue or bug report directly on GitHub with diagnostics attached. |
| `/about` | Print version, platform, architecture, and environment details. |

---

## 6. Interactive Session, Shortcuts & Input Prefixes

### Input Prefixes
- `/` (Slash Command): Opens interactive command menu with autocomplete.
- `!` (Shell Passthrough): Executes command in host shell directly (e.g. `!git status`). Typing `!` alone toggles full shell mode with distinct styling.
- `@` (At-Command Context): Injects contents of a file or directory into prompt (e.g. `@src/auth.ts Explain login flow`). Git-ignored files are filtered out automatically.

### Keybindings Cheatsheet
| Key | Action | Description |
| :--- | :--- | :--- |
| `Shift+Tab` | Cycle Approval Modes | Cycles `default` → `auto_edit` → `plan`. |
| `Esc` | Cancel / Dismiss | Dismisses dialogs or cancels active turn execution. |
| `Esc Esc` | Rewind | Triggers `/rewind` dialog to roll back turns and file changes. |
| `Ctrl+C` | Interrupt / Clear | Cancels active request, or clears input field when idle. |
| `Ctrl+D` | Exit | Exits CLI when input buffer is empty. |
| `Ctrl+T` | Toggle Todos | Toggles visual progress display of the agent's subtasks (`write_todos`). |
| `Ctrl+O` | External Editor | Opens the composer prompt in configured `$EDITOR`. |
| `Ctrl+R` | History Search | Starts reverse history search through previous session prompts. |
| `Ctrl+Z` | Undo Input | Undo text editing inside the input prompt. |

---

## 7. Plan Mode & Task Planning (`/plan`)

Plan Mode provides an isolated, read-only environment to research codebases and formulate architectures before writing code:

### How to Use Plan Mode
1. **Entering**:
   ```bash
   # In session:
   /plan Design Stripe webhook integration
   # Or press Shift+Tab until [PLAN] mode is active
   # At launch:
   gemini --approval-mode=plan
   ```
2. **Behavior**:
   - Agent can use read tools (`read_file`, `list_directory`, `glob`, `search_file_content`, `web_search`).
   - Modifying tools (`write_file`, `replace`, `run_shell_command`) are blocked.
   - Plan is formulated step-by-step and presented for user review.
3. **Execution**:
   - Once aligned, cycle back to `default` or `auto_edit` using `Shift+Tab` to execute the approved plan.

---

## 8. Project Guidance & Context (`GEMINI.md`)

Gemini CLI uses hierarchical markdown files to ground agent behavior:

### Context Locations & Precedence
1. **Global Instructions**: `~/.gemini/GEMINI.md` (applies to all projects on machine).
2. **Workspace Root**: `./GEMINI.md` or `./.gemini/GEMINI.md` (applies to active project).
3. **Subdirectories**: `./src/GEMINI.md` (scoped to sub-packages or monorepo packages).

### File Filtering (`.geminiignore`)
Place `.geminiignore` in your repository root to exclude confidential files, database dumps, build artifacts, or vendor directories from `@` indexing and model context.

---

## 9. Extensibility: Extensions, Skills, MCP, Hooks & Subagents

### Subagents (`/agents`)
Subagents are isolated specialist agents running with separate context windows and specialized toolsets:
- **Built-in specialists**: Codebase researcher, Test designer, Docs auditor.
- **Definition**: Place YAML/Markdown definitions under `.gemini/agents/` or `~/.gemini/agents/`.

### Model Context Protocol (`/mcp`)
Configure external tool servers in `.gemini/settings.json`:
```json
{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git", "."]
    }
  }
}
```

### Extensions (`/extensions`)
Install bundled packages containing prompts, MCP servers, hooks, and skills:
```bash
gemini extensions install <github-repo>
```

---

## 10. Automation, Checkpoints, Git Worktrees & Headless Mode

### Headless Execution (`-p`, `--prompt`)
Execute non-interactive queries in CI/CD pipelines or automated scripts:
```bash
gemini -p "Run pytest and fix any broken assertion in tests/test_auth.py" --approval-mode=auto_edit
```

### Git Worktrees (`-w`, `--worktree`)
Run isolated experiments in dedicated git worktrees without disrupting your main branch:
```bash
gemini -w refactor-api "Refactor GraphQL resolvers to use DataLoader"
```

### Shadow Git Rollback (`/restore`)
If an automated refactor introduces unwanted changes:
```bash
/restore
# Select the checkpoint to rollback files instantaneously
```
