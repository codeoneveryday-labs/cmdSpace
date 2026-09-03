# OpenCode: Comprehensive Documentation & Reference Guide

> Source: [OpenCode Official Documentation](https://opencode.ai/docs/)  
> Compiled from official docs: Overview, Installation, CLI Options, TUI Shortcuts, Built-in Commands, Custom Commands, Permissions & Security, Agents & Subagents, MCP Servers, and Configuration.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Supported Platforms & Installation](#2-supported-platforms--installation)
3. [Providers & Authentication (`/connect`)](#3-providers--authentication-connect)
4. [CLI Commands & Global Flags](#4-cli-commands--global-flags)
5. [Interactive TUI, Navigation & Syntax](#5-interactive-tui-navigation--syntax)
6. [Complete Built-in Slash Commands Reference](#6-complete-built-in-slash-commands-reference)
7. [Custom Commands System (`.opencode/commands/`)](#7-custom-commands-system-opencodecommands)
8. [Permissions & Security Model](#8-permissions--security-model)
9. [Agents & Subagents Architecture](#9-agents--subagents-architecture)
10. [Configuration (`opencode.jsonc`), LSP, MCP & ACP Support](#10-configuration-opencodejsonc-lsp-mcp--acp-support)
11. [Context Window Monitoring & Calculation (`% Context`)](OPENCODE_CONTEXT_WINDOW.md)

---

## 1. Overview & Architecture

**OpenCode** (`opencode`) is an open-source AI coding agent built for the terminal, desktop, and IDEs. It provides an intelligent, agentic terminal workflow with deep codebase navigation, automated editing, git integration, subagent delegation, and extensive provider support.

### Key Architectural Invariants
- **Multi-Provider & Model Agnostic**: Supports Anthropic Claude, OpenAI, Google Gemini, Ollama, Groq, Mistral, DeepSeek, OpenRouter, and custom OpenAI-compatible endpoints.
- **Git-Native History & Undo**: Every file modification made by OpenCode is tracked against Git. The `/undo` and `/redo` commands revert or re-apply exact code changes across your project.
- **Subagent Delegation (`subtask`)**: Allows complex tasks to be handed off to specialized subagents (such as a separate planning or testing agent) without polluting the primary conversation context.
- **Agent Client Protocol (ACP)**: Supports ACP for seamless integration with external IDEs, multiplexers, and desktop clients.
- **Model Context Protocol (MCP)**: Pluggable MCP server integration for external tools, databases, and enterprise services.

---

## 2. Supported Platforms & Installation

### System Requirements
- **Operating Systems**: macOS (Apple Silicon & Intel), Linux (all modern distributions), Windows (native and WSL2).
- **Prerequisites**: A modern terminal emulator (Ghostty, WezTerm, Alacritty, Kitty, iTerm2, or cmdSpace).

### Installation Methods

#### 1. Official Install Script (Recommended)
```bash
curl -fsSL https://opencode.ai/install | bash
```

#### 2. Package Managers (Node.js)
```bash
# npm
npm install -g opencode-ai

# Bun
bun add -g opencode-ai

# pnpm
pnpm add -g opencode-ai

# Yarn
yarn global add opencode-ai
```

#### 3. Homebrew (macOS / Linux)
```bash
brew install opencode
```

#### 4. Verification
```bash
opencode --version
```

---

## 3. Providers & Authentication (`/connect`)

OpenCode does not lock you into a single LLM vendor. You can configure providers via the interactive `/connect` command or environment variables.

### Interactive Provider Setup
Inside the TUI, run:
```bash
/connect
```
This opens an interactive selector where you can pick your provider and enter your API key securely:
- **Anthropic**: `ANTHROPIC_API_KEY`
- **OpenAI**: `OPENAI_API_KEY`
- **Google Gemini**: `GEMINI_API_KEY`
- **OpenRouter**: `OPENROUTER_API_KEY`
- **Groq**: `GROQ_API_KEY`
- **DeepSeek**: `DEEPSEEK_API_KEY`
- **Mistral**: `MISTRAL_API_KEY`
- **Ollama**: Local endpoint `http://localhost:11434` (no API key required)

### CLI Authentication
You can also manage authentication from outside the TUI:
```bash
# Authenticate with a provider
opencode auth login

# Check authentication status
opencode auth status

# Logout
opencode auth logout
```

---

## 4. CLI Commands & Global Flags

Running `opencode` without arguments opens the TUI in the current directory. OpenCode also provides a powerful command-line interface for scripting and headless automation.

### Primary CLI Commands
| Command | Description | Example |
| :--- | :--- | :--- |
| `opencode [dir]` | Launch interactive TUI in current or target directory | `opencode ~/dev/my-project` |
| `opencode run "<prompt>"` | Run a single non-interactive prompt / headless task | `opencode run "Fix typescript errors in src/"` |
| `opencode attach <session>` | Attach to an active or background OpenCode session | `opencode attach ses_123` |
| `opencode auth` | Manage LLM provider credentials and API keys | `opencode auth login` |
| `opencode models` | List all available and configured LLM models | `opencode models` |
| `opencode session` | List, inspect, resume, or delete historical sessions | `opencode session list` |
| `opencode export` | Export session conversation to Markdown or JSON | `opencode export ses_123 -o chat.md` |
| `opencode import` | Import an external session or transcript | `opencode import chat.json` |
| `opencode stats` | View token usage, duration, and session cost statistics | `opencode stats` |
| `opencode mcp` | Manage Model Context Protocol (MCP) servers | `opencode mcp list` |
| `opencode acp` | Start Agent Client Protocol daemon for editor bridge | `opencode acp` |
| `opencode serve` | Run headless HTTP / WebSocket server for remote clients | `opencode serve --port 4000` |
| `opencode web` | Launch the web-based UI in your browser | `opencode web` |
| `opencode upgrade` | Upgrade OpenCode binary to the latest release | `opencode upgrade` |
| `opencode uninstall` | Remove OpenCode binary and global configurations | `opencode uninstall` |

### Key Flags
- `--auto`: Enable **Auto Mode** (automatically approves all safe permission requests without prompting).
- `--model <name>`: Override the LLM model for the session (e.g. `--model anthropic/claude-3-7-sonnet`).
- `--agent <name>`: Select the active primary agent (e.g. `--agent plan` or `--agent build`).
- `--session <id>`: Resume an existing session by ID.
- `--dangerously-skip-permissions`: Bypass all security checks (use only in isolated sandboxes/containers).

---

## 5. Interactive TUI, Navigation & Syntax

### Special Prompt Syntax

#### 1. File & Directory References (`@`)
Prefix any word with `@` to fuzzy search files, folders, or configured references:
```text
How does authentication work in @src/auth/jwt.ts?
Refactor the tests in @tests/api/
```
The referenced file content is automatically attached to the prompt context.

#### 2. Shell Command Injection (`!`)
Run a quick bash command directly from the prompt input by prefixing with `!`:
```bash
!git status -s
!pnpm test
```
The command output is captured and injected into the conversation stream as tool output.

#### 3. In-Prompt Bash Interpolation (`!command`)
Inject shell output directly into an LLM prompt:
```text
Here is the current git diff:
!`git diff`
Please write a conventional commit message for these changes.
```

### Keyboard Shortcuts (Leader Key: `Ctrl+X`)
| Shortcut | Action |
| :--- | :--- |
| `Ctrl+X M` | Switch active Model (`/models`) |
| `Ctrl+X N` | Start New Session (`/new`) |
| `Ctrl+X L` | List / Switch Sessions (`/sessions`) |
| `Ctrl+X C` | Compact / Summarize Context (`/compact`) |
| `Ctrl+X U` | Undo Last Message & File Edits (`/undo`) |
| `Ctrl+X R` | Redo Reverted Message (`/redo`) |
| `Ctrl+X E` | Open External Editor (`/editor`) |
| `Ctrl+X T` | Cycle Themes (`/themes`) |
| `Ctrl+X X` | Export Chat to Markdown (`/export`) |
| `Ctrl+X Q` | Quit / Exit OpenCode (`/exit`) |
| `Ctrl+T` | Cycle reasoning / thinking variants for supported models |

---

## 6. Complete Built-in Slash Commands Reference

All slash commands can be typed directly into the prompt bar starting with `/`:

| Command | Aliases | Description |
| :--- | :--- | :--- |
| `/init` | | Guided setup wizard to generate or update `AGENTS.md` rules. |
| `/connect` | | Configure AI providers and input API keys. |
| `/models` | | Open modal to select and switch active LLM models. |
| `/sessions` | `/resume`, `/continue` | Browse, resume, and switch between saved sessions. |
| `/new` | `/clear` | Start a fresh session with cleared conversation history. |
| `/compact` | `/summarize` | Condense and summarize message history to free context window. |
| `/details` | | Toggle visibility of granular tool execution details and arguments. |
| `/thinking` | | Toggle visibility of extended reasoning/thinking thought blocks. |
| `/undo` | | Revert the last user message, LLM responses, and all associated file edits. |
| `/redo` | | Re-apply the undone message and restore file changes. |
| `/editor` | | Open your `$EDITOR` (VS Code, Neovim, Nano) to draft a long prompt. |
| `/share` | | Generate a secure web URL to share the conversation transcript. |
| `/unshare` | | Revoke public sharing for the current session. |
| `/export` | | Export the current session into Markdown. |
| `/themes` | | Switch TUI color themes (dark, light, high-contrast, etc.). |
| `/help` | | Display help menu and shortcut reference. |
| `/exit` | `/quit`, `/q` | Terminate the OpenCode session and return to shell. |

---

## 7. Custom Commands System (`.opencode/commands/`)

OpenCode allows developers and teams to create custom reusable slash commands defined via **Markdown** files or **JSON**.

### Location Priority
1. **Project-local**: `.opencode/commands/<name>.md`
2. **Global**: `~/.config/opencode/commands/<name>.md`

### Markdown Command Definition Example
Create `.opencode/commands/review.md`:
```markdown
---
description: Comprehensive PR code review
agent: plan
model: anthropic/claude-3-7-sonnet
---

Review the recent code changes in this workspace:
!`git diff main...HEAD`

Focus on:
1. Logic correctness and potential race conditions
2. Security vulnerabilities
3. Performance regressions
4. Test coverage gaps
```
This automatically registers `/review` in the TUI autocomplete menu!

### Command Arguments & Interpolation
- `$ARGUMENTS`: Entire argument string passed after the command name.
- `$1`, `$2`, `$3`: Positional arguments (e.g. `/component Button Primary`).
- `@<file>`: Automatically injects file contents.
- `!<command>`: Injects shell command output into the prompt.

---

## 8. Permissions & Security Model

OpenCode enforces a granular capability-based permission model configured in `opencode.json` (or `opencode.jsonc`).

### Permission Actions
- `"allow"`: Automatically execute without asking the user.
- `"ask"`: Prompt the user for confirmation (`once`, `always`, or `reject`).
- `"deny"`: Block the action immediately.

### Tools Controlled by Permissions
- `bash`: Running shell commands (supports granular glob matching, e.g. `"git *": "allow"`, `"rm *": "deny"`).
- `read`: Reading files (by default, `*.env` files are blocked from being read).
- `edit`: Creating, modifying, or deleting files.
- `glob`: Searching file paths.
- `grep`: Searching file contents with regex.
- `task`: Spawning subagents.
- `external_directory`: Accessing files outside the project root directory.
- `doom_loop`: Safety trigger when the agent repeats identical actions 3+ times.

### Auto Mode (`--auto`)
When started with `opencode --auto` (or toggled via the palette in TUI):
- Any action configured as `"ask"` is automatically approved.
- Any action explicitly set to `"deny"` remains blocked.

### Example `opencode.json` Permission Configuration
```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "*": "ask",
    "read": {
      "*": "allow",
      "*.env": "deny",
      "*.env.*": "deny"
    },
    "bash": {
      "*": "ask",
      "git status*": "allow",
      "git diff*": "allow",
      "npm test*": "allow",
      "rm -rf *": "deny"
    },
    "external_directory": {
      "~/dev/shared-libs/**": "allow"
    }
  }
}
```

---

## 9. Agents & Subagents Architecture

OpenCode features built-in agents and allows creating custom specialized subagents.

### Standard Agents
- **`build`**: Primary general-purpose software development agent with access to full tools (terminal, editor, grep, search).
- **`plan`**: Read-only planning and architectural analysis agent (does not modify code without user approval).

### Custom Agent Definition (`opencode.json`)
```json
{
  "agent": {
    "security-auditor": {
      "mode": "subtask",
      "model": "anthropic/claude-3-7-sonnet",
      "description": "Performs static security analysis and audits dependencies",
      "permission": {
        "bash": "deny",
        "edit": "deny",
        "read": "allow"
      }
    }
  }
}
```
Setting `"mode": "subtask"` ensures this agent runs in an isolated subtask and reports findings back to the main chat session.

---

## 10. Configuration (`opencode.jsonc`), LSP, MCP & ACP Support

### Configuration File Locations
- Project: `./opencode.json` or `./opencode.jsonc`
- User Global: `~/.config/opencode/config.json`

### Model Context Protocol (MCP)
OpenCode integrates seamlessly with MCP servers:
```json
{
  "mcp": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    }
  }
}
```

### Agent Client Protocol (ACP)
OpenCode natively supports ACP, enabling terminal multiplexers like cmdSpace, IDE plugins, and external desktop orchestrators to drive OpenCode sessions over standard input/output RPC.
