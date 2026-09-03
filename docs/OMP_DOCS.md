# OMP (Oh-My-Pi): Comprehensive Documentation & Reference Guide

> Source: [omp.sh Official Documentation & CLI Reference](https://omp.sh/docs/cli)  
> Repository: [github.com/can1357/oh-my-pi](https://github.com/can1357/oh-my-pi)  
> Compiled from official docs: Overview, Installation, CLI Launch Flags, Model Roles, Thinking & Reasoning, Prewalk & Plan Modes, Tool Approval Policy (`yolo`), Keybindings, Slash Commands, Subagents, and Native Rust Engine.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Supported Platforms & Installation](#2-supported-platforms--installation)
3. [CLI Reference & Launch Flags](#3-cli-reference--launch-flags)
4. [Model Roles & Selection Architecture](#4-model-roles--selection-architecture)
5. [Thinking & Reasoning Modes](#5-thinking--reasoning-modes)
6. [Plan & Prewalk Modes](#6-plan--prewalk-modes)
7. [Tool Approval System (`yolo`, `write`, `always-ask`)](#7-tool-approval-system-yolo-write-always-ask)
8. [TUI Shortcuts & Keybindings](#8-tui-shortcuts--keybindings)
9. [Slash Commands & Runtime Interactions](#9-slash-commands--runtime-interactions)
10. [Advanced Capabilities: Subagents, LSP, DAP & Native Internals](#10-advanced-capabilities-subagents-lsp-dap--native-internals)
11. [Context Window Monitoring & Calculation (`% Context`)](OMP_CONTEXT_WINDOW.md)

---

## 1. Overview & Architecture

**OMP** (`omp` / `oh-my-pi`) is an ultra-fast, terminal-native AI coding agent built by Stencil (forked and heavily extended from Mario Zechner's Pi). It features an in-process native Rust engine (~80k lines of Rust) running tools without fork/exec overhead, complete LSP and DAP debugger integration, first-class subagent delegation, and custom memory systems.

### Core Architectural Invariants
- **In-Process Native Tool Execution**: Unlike traditional agents that spawn external shell subprocesses (`rg`, `grep`, `find`), OMP embeds ripgrep, globbing, and 58 core Unix command-line utilities in-process via Rust.
- **Hashline Edits**: Edits files by content hash anchors instead of brittle string replacement diffs, eliminating line-drift and hallucinated indentation loops.
- **Multi-Role Model Dispatching**: Separates models into dedicated roles: `smol` (fast/cheap tool calling), `slow` (deep reasoning), and `plan` (architectural planning).
- **Time-Traveling Stream Rules (TTSR)**: Rules sit dormant until the model begins going off-script; an in-flight regex aborts the stream mid-token, injects the corrective rule, and retries.
- **Persistent Code Execution Bridge**: Persistent Python and Bun JavaScript execution environments where sandbox scripts can call back into the agent's own tools over a loopback bridge.
- **Editor & Multiplexer Interop**: Native ACP (Agent Client Protocol) support for editors like Zed, Neovim, and terminal multiplexers.

---

## 2. Supported Platforms & Installation

### System Requirements
- **Platforms**: macOS (Apple Silicon & Intel), Linux (glibc and musl/Alpine), Windows (Native and PowerShell).
- **Runtime**: Bun ≥ 1.3.14 (if using npm/bun package distribution).

### Installation Methods

#### 1. Official Install Script (macOS / Linux)
```sh
curl -fsSL https://omp.sh/install | sh
```
> **Alpine / musl Note**: If running Alpine, install `libstdc++` and `libgcc` first: `apk add libstdc++ libgcc`.

#### 2. Homebrew (macOS / Linux)
```sh
brew install can1357/tap/omp
```

#### 3. Bun (Recommended for JS toolchain)
```sh
bun install -g @oh-my-pi/pi-coding-agent
```

#### 4. Windows (PowerShell)
```powershell
irm https://omp.sh/install.ps1 | iex
```

#### 5. Nix
```sh
nix run github:can1357/oh-my-pi
# Or install into profile
nix profile install github:can1357/oh-my-pi
```

#### 6. Shell Completions
OMP generates completions dynamically from its live command metadata:
```sh
# zsh
eval "$(omp completions zsh)"

# bash
eval "$(omp completions bash)"

# fish
omp completions fish > ~/.config/fish/completions/omp.fish
```

---

## 3. CLI Reference & Launch Flags

OMP is invoked using:
```sh
omp [command] [flags] [messages...]
```
When the first non-flag argument is not a registered subcommand, OMP routes to the default `launch` command and treats positional arguments as the prompt.

### Common CLI Invocations
```sh
# Start interactive TUI session
omp

# Start with an initial message
omp "Refactor the authentication middleware to use JWT"

# Attach files/images to initial prompt using @
omp @src/server.ts @schema.prisma "Implement database migrations"

# Non-interactive / Headless print mode (-p)
omp -p "Run test suite and summarize errors"

# Continue the previous session
omp --continue "What were the pending items?"

# Resume specific session
omp --resume ses_01jd9...
```

### Launch Flags Reference

#### Workspace & Sessions
| Flag | Description |
| :--- | :--- |
| `--cwd <dir>` | Working directory to start in. |
| `--add-dir <dir>` | Add an extra workspace directory (repeatable). |
| `--allow-home` | Permit starting in user home (`~`) without switching to temp directory. |
| `--profile <name>` | Isolated profile for auth, sessions, settings, and cache. |
| `--config <file>` | Load an extra configuration overlay file. |
| `--continue`, `-c` | Continue the immediately preceding session. |
| `--resume [id]`, `-r` | Resume a session by ID prefix or open session picker if omitted. |
| `--fork <session>` | Fork an existing session snapshot into a new session. |
| `--from-claude` | Import a Claude Code session into OMP. |
| `--from-codex` | Import a Codex session into OMP. |
| `--export <session>` | Export session history to HTML/Markdown and exit. |
| `--no-session` | Ephemeral mode: do not persist session history to disk. |

#### Model & Provider Flags
| Flag | Description |
| :--- | :--- |
| `--model <id-or-role>` | Primary model or role (e.g. `anthropic/claude-3-7-sonnet`, `opus`, `gpt-5.2`, `@slow`). |
| `--smol <id>` | Smol model used for cheap tasks, summaries, and edits (or `PI_SMOL_MODEL`). |
| `--slow <id>` | Slow / high-reasoning model for difficult analysis (or `PI_SLOW_MODEL`). |
| `--plan <id>` | Architectural planning model (or `PI_PLAN_MODEL`). |
| `--models <a,b,c>` | Comma-separated model patterns for fast `Ctrl+P` cycling. |
| `--api-key <key>` | Explicit API key override. |
| `--service-tier <tier>` | OpenAI service tier (e.g. `default`, `scale`, `priority`). |

---

## 4. Model Roles & Selection Architecture

OMP categorizes LLMs into **functional roles** rather than forcing a single model to do everything:

1. **`primary` (`--model`)**: The default agent model driving conversational reasoning and main task loops.
2. **`smol` (`--smol`)**: Small, ultra-fast model (e.g., Claude 3.5 Haiku, GPT-4o-mini, Grok Code Fast) used for file reads, regex searches, and automated diff application.
3. **`slow` (`--slow`)**: Large frontier model (e.g., Claude 3.7 Sonnet Thinking, o3-mini) for complex deep debugging and algorithmic logic.
4. **`plan` (`--plan`)**: Dedicated model for generating architectural specifications and task decomposition.

---

## 5. Thinking & Reasoning Modes

OMP gives precise control over thinking budgets and visibility:

| Flag / Setting | Description |
| :--- | :--- |
| `--thinking <level>` | Sets thinking budget: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, or `auto`. |
| `--hide-thinking` | Hides thinking/reasoning blocks in the TUI (the model still thinks, but output remains compact). |
| `--print-thoughts` | Prints raw reasoning tokens in headless / non-interactive output. |
| `--external-thinking` | Uses a private scratchpad while bypassing vendor-gated reasoning. |

---

## 6. Plan & Prewalk Modes

OMP includes specialized execution modes to optimize quality and token cost:

### 1. Plan Mode (`/plan` or `--plan-yolo`)
Forces the agent to operate in read-only architectural planning mode. File edits (`write`, `patch`) and execution commands are disabled until the user signs off on the plan.
- `--plan-yolo`: Starts in plan mode, auto-approves the plan once the model creates the todo checklist, then switches to `--plan-yolo-into <model>` to implement it.

### 2. Prewalk Optimization (`--prewalk`)
When enabled, OMP uses a reasoning model (`--plan` / `--slow`) to explore files and assemble a task plan. As soon as the first edit begins, it automatically switches execution to a cheaper/faster model (`--prewalk-into` or `smol`).
- `--no-prewalk`: Disables prewalk model switching.

---

## 7. Tool Approval System (`yolo`, `write`, `always-ask`)

OMP structures tool safety around capability tiers and configurable approval policies.

### Tool Safety Tiers
1. **`read`**: Non-destructive inspections (e.g., reading files, searching symbols, viewing git history).
2. **`write`**: Workspace mutations without arbitrary shell execution (e.g., creating files, hashline patch, AST edits).
3. **`exec`**: Shell execution, terminal spawning, debugger attachment, desktop automation.

### Approval Modes
Configure via `tools.approvalMode` in `config.yml` or launch flags:

| Mode | Auto-Approves | Prompts User For |
| :--- | :--- | :--- |
| `always-ask` | `read` | `write`, `exec` |
| `write` | `read`, `write` | `exec` |
| **`yolo`** (Default) | `read`, `write`, `exec` | None (fully autonomous) |

- Start with `--yolo` or `--auto-approve` to enable full autonomous execution.

### User Overrides (`config.yml`)
```yaml
tools:
  approvalMode: write
  approval:
    bash: prompt
    read: allow
    mcp__filesystem_delete: deny
```

---

## 8. TUI Shortcuts & Keybindings

Run `/hotkeys` inside any OMP session to inspect the live keymap. Custom remaps are saved in `~/.omp/agent/keybindings.yml`.

| Shortcut | Default Action | Meaning |
| :--- | :--- | :--- |
| `Ctrl+P` | `app.model.cycleForward` | Cycle through configured role models |
| `Shift+Ctrl+P` | `app.model.cycleBackward` | Cycle backwards through role models |
| `Alt+Shift+P` | `app.plan.toggle` | Toggle between Plan Mode and Build Mode |
| `Alt+A` | `app.agentHub.toggle` | Open **Agent Hub** to inspect and control running subagents |
| `Ctrl+C` | Interrupt | Abort current stream or tool call |
| `Escape` | Cancel | Close active modal or dismiss picker |

---

## 9. Slash Commands & Runtime Interactions

Type `/` in the prompt composer to trigger the interactive command palette:

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/plan` | `[prompt]` | Toggle plan mode or run task with plan-first strategy. |
| `/review` | `[branch/commit]` | Spawn parallel reviewer subagents with P0-P3 issue grading. |
| `/advisor` | `status \| on \| off` | Pair a watchdog advisor model watching every turn. |
| `/collab` | `[view]` | Start a live peer-relay session with QR code and share link. |
| `/hotkeys` | | Display all active keyboard bindings and chords. |
| `/compact` | | Trigger snapcompact session summarization. |
| `/session` | | Browse, switch, or manage saved sessions. |
| `/models` | | List and select active models. |
| `/skills` | | List, inspect, and invoke loaded Agent Skills. |
| `/clear` | | Reset conversation memory and prompt buffer. |
| `/exit` | | Exit OMP and return to terminal. |

---

## 10. Advanced Capabilities: Subagents, LSP, DAP & Native Internals

### First-Class Subagents (`task`)
OMP can fan out work into parallel subagents running in isolated git worktrees. Results are validated against schemas and returned to the parent agent. Press `Alt+A` to open the live Agent Hub roster.

### Live DAP Debugger Integration
OMP connects directly to standard Debug Adapter Protocol (DAP) backends:
- **C / C++ / Rust**: Native `lldb-dap` stepping, breakpoint inspection, variable inspection.
- **Go**: `dlv` delve goroutine analysis.
- **Python**: `debugpy` stack frame evaluation.

### Language Server Protocol (LSP)
Every file modification is verified with real-time LSP diagnostics. Renames go through `workspace/willRenameFiles` so imports, re-exports, and references across the codebase update atomically.

### Custom Internal URI Schemes
OMP tools treat code and artifacts as structured URIs:
- `pr://1428`: Reads pull request metadata and diffs like a local file.
- `issue://42`: Fetches issue comments and description.
- `agent://<id>/findings.path`: Extracts structured JSON fields from subagent outputs.
- `conflict://N`: Resolves git merge conflicts by writing `@theirs`, `@ours`, or `@base`.
- `xd://resolve`: AST codemod staging and atomic multi-file replacement preview.
