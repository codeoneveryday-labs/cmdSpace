# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**cmdSpace** — terminal-first AI-native agentic development environment (ADE). Tauri 2 + Rust backend, React 19 + Vite + TypeScript frontend, xterm.js (WebGL) terminal, CodeMirror 6 editor, Vercel AI SDK v6 agents. Bundle id: `app.tranhoangpich.cmdspace`. Package manager: **pnpm**.

## Commands

```bash
# Frontend
pnpm dev                   # Vite dev server (port 1420, shell only — not the full app)
pnpm build                 # tsc + vite build
pnpm exec tsc --noEmit     # type-check only
pnpm test                  # vitest (excludes services/**)
pnpm vitest run src/modules/tabs/lib/useTabs.test.ts   # single test file

# Rust backend
cd src-tauri && cargo check --all-targets --locked
cd src-tauri && cargo clippy --all-targets --locked -- -D warnings
cd src-tauri && cargo test

# Full app (requires Rust toolchain + Tauri CLI)
pnpm tauri dev             # build and run the real desktop app
```

## Two-process model

The webview (React) **never** touches the filesystem, processes, or shells directly. All privileged ops go through `invoke()` calls to Rust commands registered in `src-tauri/src/lib.rs`. The frontend talks to Rust through three IPC clients:

- `src/modules/ai/lib/native.ts` — the de-facto client: `fs_*`, `shell_*`, `git_*`, `workspace_*` commands
- `src/modules/terminal/lib/pty-bridge.ts` — PTY lifecycle: `pty_open/write/resize/close`, streams raw bytes via `Channel<ArrayBuffer>`
- Ad-hoc `invoke()` calls elsewhere: `db_*`, `secrets_*`, `remote_access_*`, `speech_*`, `net_*`

**Never build a parallel IPC path.** Use the existing bridge and helpers.

## Architecture

```
webview (React)
  App.tsx  ── useTabs (tabs + pane tree) ── TerminalStack / EditorStack
     │  invoke()                    │  imperative handles (refs)
     ▼                              ▼
src-tauri (Rust)
  lib.rs  (~110 commands, managed state, plugins)
  modules: pty/ shell/ fs/ git/ secrets/ speech/ remote/ net/ db/
           workspace/ agent_usage/ music/ proc/
  PtyState: RwLock<HashMap<u32, Session>>
```

### Three app surfaces (three Vite HTML entries)

- `index.html` → main window (`src/app/App.tsx`)
- `settings.html` → settings window (`src/settings/main.tsx`)
- `remote.html` → remote-access UI (`src/remote/main.tsx`)

### Frontend modules (`src/modules/`)

`App.tsx` is the coordinator — it owns workspace/tab/pane state and threads it down via props. **Feature components do not duplicate that state.**

| Module | Purpose |
|---|---|
| `tabs/` | Tab + pane-tree state machine (all tab kinds: terminal, editor, ai-diff, markdown) |
| `terminal/` | Standard terminal: xterm renderer pool (fixed 12 instances), PTY bridge, OSC handlers, IME |
| `architecture/` | Infinite-canvas diagram with live terminal nodes (own PTY per node, no renderer pool) |
| `ai/` | Chat store, agent registry, tools with approval flow, voice input, edit diffs |
| `editor/` | CodeMirror 6 editor with vim mode, git/AI diffs |
| `explorer/` | File tree sidebar with fuzzy search |
| `git/` + `git-history/` + `source-control/` | Git event bus, commit graph, status panel |
| `workspaces/` + `workspace/` | Workspace setup flow + env scope (local/WSL) |

### Terminal subsystem — two distinct paths

**Standard terminals** (`src/modules/terminal/`): use a **fixed pool of 12 xterm instances** in `rendererPool.ts`. Switching panes rebinds an existing terminal via snapshot + dormant ring replay — no create/destroy. Sessions survive React remounts in a module-level `Map<leafId, Session>`.

**Canvas terminals** (`src/modules/architecture/CanvasTerminalNode.tsx`): each node owns a **private xterm instance + its own PTY**. The terminal world is an HTML layer transformed with CSS `translate3d/scale` — camera zoom never fires PTY resizes. **Never route canvas terminals through `TerminalPane` or the renderer pool.**

### AI subsystem (`src/modules/ai/`)

BYOK multi-provider: OpenAI, Anthropic, Google, Groq, xAI, Cerebras, LM Studio/Ollama. Keys stored in OS keychain (`secrets.rs`), never persisted to disk or localStorage. Agent built on Vercel AI SDK v6 `Experimental_Agent`. Tools with `needsApproval: true` pause for in-UI confirmation. AI-proposed edits open as `ai-diff` tabs — user accepts/rejects per hunk.

### Persistence

| Concern | Mechanism |
|---|---|
| Workspaces + pane launch plans | SQLite (`db.rs`), `db_*` invokes |
| Preferences | Tauri `LazyStore` + Zustand mirror |
| AI chat sessions | `LazyStore` JSON, scoped by workspace |
| API keys | OS keychain (`secrets.rs`) |
| Canvas diagrams | Serialized in workspace `paneLayout` → SQLite |
| Live terminal sessions | In-memory only (die with app) |

Tabs themselves are **not** persisted across restarts.

## Conventions

- **Commits**: conventional commits — see `commit_conventional.md`. Format: `<type>(<scope>): <imperative summary>` with `Tested:` trailer for substantive changes.
- **No file deletion** without explicit user permission — even files you created.
- **No destructive git commands** (`reset --hard`, `clean -fd`, `force-push` to main) without explicit authorization.
- **Path imports**: always `@/…` (aliased to `src/`), never relative paths across modules.
- **Cross-platform paths**: normalize with `.split(/[\\/]/)`, not `.split("/")`. Canonical frontend form is forward-slash.
- **Tailwind v4**: config lives in CSS via `@theme` (no `tailwind.config.*`). Use `cn()` from `@/lib/utils`.
- **shadcn/ui components** in `src/components/ui/` — regenerate via `pnpm dlx shadcn add`, don't hand-edit.
- **Terminal input**: send `\r` (CR) for Enter, not `\n` (LF) — PowerShell requires CR.
- **New Rust commands**: register in `lib.rs::run()` `invoke_handler` + add capability in `src-tauri/capabilities/default.json`.
- **Platform-specific Rust**: gate behind `#[cfg(unix)]` / `#[cfg(windows)]` — see `pty/shell_init.rs`.

## Known gotchas

- **React 19 strict mode** double-spawns PTYs in dev — expected, not a bug. `SPAWN_LOCK` mutex serializes it.
- **macOS IME**: WebKit surfaces spaces as C1 controls or NBSP — normalize at the IME boundary (`normalizeMacTerminalInput` in `macImeBridge.ts`), not elsewhere.
- **Windows ConPTY**: `SPAWN_LOCK` required around `openpty + spawn_command`; Job Object in `pty/job.rs` kills descendant processes on app death — don't remove it.
- **OSC 7 cwd tracking**: ignore cwd updates while `inCommand` is true (command output is untrusted).
- **Terminal input debugging**: log with hex dumps at the PTY boundary — `JSON.stringify` collapses C1/NBSP into plain spaces and will mislead you.
- **Parallel cargo test temp dirs**: use `mailbox::temp_test_dir()` helper (pid + atomic sequence) — nanos alone collide across threads on coarse clocks.

## Installed plugins

### superpowers (oh-my-claudecode)

General-purpose workflow skills that auto-trigger at the right moments:

- `brainstorming` — explores intent, requirements, and design before implementation
- `writing-plans` — designs implementation approach for user approval
- `executing-plans` — executes a written plan with review checkpoints
- `subagent-driven-development` — parallelizes independent tasks via subagents
- `dispatching-parallel-agents` — fans out 2+ independent tasks
- `test-driven-development` — red-green-refactor workflow
- `systematic-debugging` — diagnosis loop for hard bugs
- `using-git-worktrees` — isolated workspace via worktrees
- `finishing-a-development-branch` — integrate complete work
- `requesting-code-review` / `receiving-code-review` — review workflows
- `verification-before-completion` — requires evidence before claiming done
- `writing-skills` — authoring reference for new skills

## Further reading

- `CMDSPACE.md` — authoritative architecture doc (load first for deep work)
- `COMPREHENSIVE_PLAN.md` — module map, Rust command map, how to add/debug/ship
- `docs/architecture/design-patterns.md` — pattern contract (read before structural changes)
- `docs/RELEASE_RUNBOOK.md` — release procedure
- `docs/adr/` — architecture decision records
- `AGENTS.md` — project-specific agent rules (no file deletion, no destructive git, code search via `semble`)
