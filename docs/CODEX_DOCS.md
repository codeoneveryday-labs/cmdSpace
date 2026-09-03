# OpenAI Codex: Comprehensive Documentation & Reference Guide

> Source: [OpenAI Developers & ChatGPT Learn Documentation](https://learn.chatgpt.com/docs/quickstart#setup-app-send-message)  
> Compiled from official docs: Overview, Codex CLI, Developer Commands, Codex Manual, Agent Approvals & Security, Speed, and Configuration Reference.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Supported Platforms & Installation](#2-supported-platforms--installation)
3. [Interactive Session & Keyboard Controls](#3-interactive-session--keyboard-controls)
4. [Permission System & Approval Modes](#4-permission-system--approval-modes)
5. [Complete Slash Commands Reference](#5-complete-slash-commands-reference)
6. [Fast Mode & Speed Configuration](#6-fast-mode--speed-configuration)
7. [Configuration & Settings (`config.toml`)](#7-configuration--settings-configtoml)
8. [Project Guidance & Instructions (`AGENTS.md`)](#8-project-guidance--instructions-agentsmd)
9. [Extensibility: Subagents, Skills, MCP & Plugins](#9-extensibility-subagents-skills-mcp--plugins)
10. [Automation, Review & Cloud Workflows](#10-automation-review--cloud-workflows)
11. [Context Window Monitoring & Calculation (`% Context`)](CODEX_CONTEXT_WINDOW.md)

---

## 1. Overview & Architecture

**OpenAI Codex** is OpenAI's agentic development environment designed to inspect codebases, execute terminal commands, edit files across repositories, run tests, and collaborate with developers directly in their terminal, code editor, desktop app, or cloud environment.

### Core Principles
- **Terminal-First Agentic Loop**: Codex inspects repository structure, reads files, plans changes, makes surgical edits, runs local build/test tools, and inspects diffs.
- **Fail-Safe Sandboxing & Permissions**: Local command execution is contained in sandbox boundaries with explicit approval policies (`read-only`, `workspace-write`, `dangerously-bypass-approvals-and-sandbox` / YOLO).
- **Multi-Surface Continuity**: Work initiated in the Codex CLI can be resumed, forked, reviewed, or continued in the ChatGPT desktop app or Codex Cloud.
- **Protocol-Driven Extensibility**: Operates with MCP (Model Context Protocol), reusable skills, plugins, and app-server WebSocket/stdio protocols.

---

## 2. Supported Platforms & Installation

Codex is available across macOS, Linux, Windows, VS Code, JetBrains, ChatGPT Desktop, and Cloud.

### Installation Options

#### 1. macOS / Linux (Standalone Installer)
```bash
# Install
curl -fsSL https://chatgpt.com/codex/install.sh | sh

# Update
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

#### 2. Homebrew (macOS)
```bash
# Install
brew install --cask codex

# Update
brew upgrade --cask codex
```

#### 3. npm (Cross-platform)
```bash
# Install
npm install -g @openai/codex

# Update
npm install -g @openai/codex
```

#### 4. Windows (PowerShell Standalone)
```powershell
# Install
powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"

# Update
powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"
```

### Launching Codex
- **Interactive TUI**: Run `codex` inside any project directory.
- **Bypass Approvals (YOLO mode)**: `codex --dangerously-bypass-approvals-and-sandbox`
- **Non-Interactive Batch Mode**: `codex exec "run tests and fix failures"`
- **Connect to Remote App Server**: `codex --remote ws://host:port`

---

## 3. Interactive Session & Keyboard Controls

The Codex TUI (Terminal User Interface) provides rich interactive features during live sessions:

### Keyboard Shortcuts & Navigation
| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Tab` | Queue Next Turn | When Codex is actively working, press `Tab` to queue a follow-up prompt or slash command. |
| `Ctrl+O` | Copy Output | Copy the latest completed response directly to clipboard without manual selection. |
| `Ctrl+L` | Clear Terminal View | Clears visible terminal buffer while preserving chat history (unlike `/clear`). |
| `Alt+R` | Raw Output Toggle | Toggle raw scrollback mode for direct text selection. |
| `Esc` | Cancel / Dismiss | Dismiss active modals, dialogs, or interrupt execution turns. |

### Vim Mode (`/vim`)
- Type `/vim` in the composer to toggle between standard input editing and Vim modal editing (normal/insert).
- Default persistence can be configured with `tui.vim_mode_default = true` in `config.toml`.

---

## 4. Permission System & Approval Modes

Codex employs a layered security model governing what operations require human approval:

### Approval Presets (`/permissions`)
1. **Auto (YOLO mode)**:
   - Grants hands-off execution for commands and file modifications.
   - CLI flag: `--dangerously-bypass-approvals-and-sandbox`.
2. **On-request (Default / Standard)**:
   - Codex prompts for approval before running modifying commands or modifying files outside workspace roots.
   - CLI flag: `--ask-for-approval on-request --sandbox workspace-write`.
3. **Read Only**:
   - Only non-modifying read and inspection tools are allowed without approval.
   - Any write or execution triggers explicit approval prompts.
4. **Approval Retry (`/approve`)**:
   - If an automated reviewer denies an action, run `/approve` to retry the denied operation once under current session policy.

---

## 5. Complete Slash Commands Reference

Codex CLI features a built-in slash command palette. Type `/` in the prompt to open and filter:

| Slash Command | Purpose | Usage & Example |
| :--- | :--- | :--- |
| `/permissions` | Change approval presets & sandbox rules | `/permissions` (Select Auto, On-request, Read Only) |
| `/fast` | Toggle model's Fast service tier | `/fast` (Turns fast inference on or off) |
| `/plan` | Enter Plan Mode without immediate file edits | `/plan` or `/plan Design auth module refactor` |
| `/goal` | Set, view, edit, pause, resume, or clear a task goal | `/goal <objective>`, `/goal`, `/goal clear` |
| `/review` | Perform working tree or git diff code review | `/review` (Reviews uncommitted changes) |
| `/status` | Inspect active model, token usage & permissions | `/status` |
| `/model` | Select active model & reasoning effort | `/model` (e.g., `gpt-5.6-luna`, `gpt-5.6-terra`) |
| `/usage` | View token consumption and rate-limit statistics | `/usage`, `/usage daily`, `/usage weekly` |
| `/diff` | Review git diff including untracked files | `/diff` |
| `/mcp` | List configured Model Context Protocol tools | `/mcp`, `/mcp verbose` |
| `/skills` | Browse and activate task-specific skills | `/skills` |
| `/apps` | Browse and attach workspace apps/connectors | `/apps` |
| `/plugins` | Inspect, install, and manage plugins | `/plugins` |
| `/subagents` / `/agent` | Switch active agent threads and subagents | `/subagents`, `/agent <id>` |
| `/personality` | Select communication style | `/personality` (`friendly`, `pragmatic`, `none`) |
| `/ps` | List background terminal jobs | `/ps` |
| `/stop` | Terminate active background terminal jobs | `/stop` |
| `/new` | Start a new chat within the same CLI session | `/new` |
| `/clear` | Clear terminal and start a fresh chat context | `/clear` or `/clear <chat-name>` |
| `/compact` | Summarize session history to reclaim context window | `/compact` |
| `/copy` | Copy latest completed assistant response | `/copy` |
| `/ide` | Attach active IDE editor context and open files | `/ide` |
| `/import` | Import setups and chats from Claude Code or Cursor | `/import` |
| `/init` | Scaffold project-level `AGENTS.md` instructions | `/init` |
| `/statusline` | Customize TUI footer items interactively | `/statusline` |
| `/title` | Customize terminal tab/window title format | `/title` |
| `/theme` | Select syntax highlighting theme | `/theme` |
| `/pets` | Enable, customize, or disable ambient terminal pets | `/pets`, `/pets off` |
| `/resume` | Resume previous saved chats | `/resume` |
| `/fork` | Branch the current chat into a new session | `/fork` |
| `/side` / `/btw` | Open ephemeral side investigation chat | `/side <question>` |
| `/raw` | Toggle raw terminal scrollback output | `/raw`, `/raw on`, `/raw off` |
| `/vim` | Toggle composer Vim mode | `/vim` |
| `/keymap` | Remap TUI keyboard shortcuts | `/keymap` |
| `/debug-config` | View configuration layers and precedence diagnostics | `/debug-config` |
| `/feedback` | Submit diagnostic logs to maintainers | `/feedback` |
| `/logout` | Sign out of ChatGPT / Codex | `/logout` |
| `/quit` / `/exit` | Exit the CLI session | `/quit` or `/exit` |

---

## 6. Fast Mode & Speed Configuration

Codex supports high-speed inference through catalog-driven Fast service tiers:

### How Fast Mode Works in Codex
- **Catalog-Driven**: Available when the active model exposes a Fast tier in the model catalog.
- **Toggling (`/fast`)**:
  - Run `/fast` to enable the fastest inference mode.
  - Run `/fast` again to revert to standard inference.
- **Persistence**: Toggling persists across subsequent turns in the session.
- **Statusline Visibility**: Use `/statusline` to add a Fast indicator to the TUI footer.

---

## 7. Configuration & Settings (`config.toml`)

Codex configuration resides at `~/.codex/config.toml` (global) and `.codex/config.toml` (project-local).

### Precedence Order
1. Command-line flags (`-c key=value`)
2. Environment variables (`CODEX_*`)
3. Project configuration (`.codex/config.toml`)
4. Global user configuration (`~/.codex/config.toml`)
5. Managed enterprise defaults

### Sample `config.toml`
```toml
# Model and execution preferences
model = "gpt-5.6-luna"
fast_mode = true

[approval]
policy = "on-request"
sandbox = "workspace-write"

[tui]
theme = "dark"
vim_mode_default = false
status_line = ["model", "git", "tokens", "rate_limits"]
raw_output_mode = false

[mcp]
# Model Context Protocol servers
[mcp.servers.github]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-github"]
```

---

## 8. Project Guidance & Instructions (`AGENTS.md`)

Codex reads project-specific guidance automatically from `AGENTS.md` located in the repository root or subdirectories.

### Initializing `AGENTS.md`
Run `/init` to scaffold a tailored `AGENTS.md` containing:
- Project build, test, and lint commands.
- Code style conventions and architecture rules.
- Operational guardrails and safety guidelines.

---

## 9. Extensibility: Subagents, Skills, MCP & Plugins

Codex provides modular expansion interfaces:

### Skills (`/skills`)
- Reusable domain workflows placed under `.codex/skills/` or `~/.codex/skills/`.
- Packaged with a `SKILL.md` defining triggers, instructions, and scripts.

### MCP (Model Context Protocol) (`/mcp`)
- Standard protocol connecting Codex to external databases, APIs, and devtools.
- Inspect connected servers with `/mcp` and test tool execution.

### Plugins & Apps (`/plugins`, `/apps`)
- Enterprise connectors and integrations that extend Codex with external services (GitHub, Jira, Linear, Slack).

---

## 10. Automation, Review & Cloud Workflows

### Batch Automation with `codex exec`
Run unattended automation tasks in CI/CD or local scripts:
```bash
codex exec "Review PR changes and run linting" --json
```

### Dedicated Code Review (`/review`)
Run prioritized reviews against local changes, specific branches, or commits without altering the working tree.

### Cloud Delegation
Delegate long-running investigations or large builds to Codex Cloud with `codex cloud` and apply diffs back locally with `codex apply`.
