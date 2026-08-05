# COMPREHENSIVE PLAN — cmdSpace

**cmdSpace (repo dir `terax-ai`) — a terminal-first, AI-native agentic development
environment (ADE).** Tauri 2 + Rust backend, React 19 + Vite + TypeScript
frontend, xterm.js (WebGL) terminal, CodeMirror 6 editor, Vercel AI SDK agents.

> Status: living plan. The authoritative architecture doc is
> [`CMDSPACE.md`](CMDSPACE.md); this plan is the **map**: what the product is,
> how the code is organized, where to make a change, and how to ship it. Read
> this end-to-end once, then use `CMDSPACE.md` and `docs/` for depth.

---

## Table of Contents

1. [Reading guide](#1-reading-guide)
2. [Executive summary](#2-executive-summary)
3. [What this repo is NOT](#3-what-this-repo-is-not)
4. [Tech stack](#4-tech-stack)
5. [Architecture at a glance](#5-architecture-at-a-glance)
6. [Frontend module map](#6-frontend-module-map)
7. [Rust command map](#7-rust-command-map)
8. [Terminal subsystem (deep dive)](#8-terminal-subsystem)
9. [Persistence model](#9-persistence-model)
10. [How to add a feature](#10-how-to-add-a-feature)
11. [How to debug](#11-how-to-debug)
12. [How to ship (release)](#12-how-to-ship)
13. [Known gotchas](#13-known-gotchas)
14. [Backlog & open issues](#14-backlog--open-issues)
15. [Risks & open questions](#15-risks--open-questions)

---

## 1. Reading guide

The single most important fact about this codebase:

> **The webview (React) never touches the filesystem, processes, or shells.**
> Everything privileged goes through `invoke()` to a Rust command in
> `src-tauri/src/lib.rs`. Keep that contract; never build a parallel IPC path.

If you remember one sentence, that is it. Everything else follows from it.

Sources of truth, in priority order:

- `CMDSPACE.md` — living architecture doc (module layout, PTY integration,
  AI subsystem, UI conventions, window styling, known gotchas).
- `docs/AGENT_GITHUB_DELIVERY.md` — mandatory read before any GitHub work.
- `docs/RELEASE_RUNBOOK.md` — the release procedure.
- `docs/WORKFLOW.md` — the Harness workflow (read-only vs. bounded vs. planned
  changes; plans live in `docs/plans/active/`).
- `docs/MERGE_BLOCKERS.md` — the merge gate: known defects that must not ship.
- `docs/adr/` — architecture decision records (two-process model, renderer
  pool, IME bridge).
- `docs/architecture/` — deep-dives split out of `CMDSPACE.md` (e.g.
  `terminal-input-pipeline.md`).
- `commit_conventional.md` — commit format.

## 2. Executive summary

**Goal.** A desktop ADE where the terminal is the center of gravity and an AI
coding agent works beside you — in the same shell, on the same files, with
reviewable edits.

**Surface.**
- Real PTY terminal workspaces (zsh/bash/fish/pwsh/WSL/cmd) with multi-tab,
  splits, OSC 7/133 shell integration, and a **canvas mode** where live
  terminals are nodes on an infinite SVG diagram.
- AI coding agents: multi-provider BYOK (OpenAI, Anthropic, Google, Groq, xAI,
  Cerebras, OpenRouter/DeepSeek/Mistral, LM Studio/Ollama), sub-agents, tools
  with approval flow, reviewable AI edit diffs, voice input.
- CodeMirror 6 editor (vim mode, inline AI autocomplete), file explorer, git
  (stage/commit/push/history graph), web preview of local dev servers.
- **Remote access**: mobile-browser terminal over a WebSocket + QR-paired
  localhost tunnel.
- Privacy: no telemetry, no accounts, keys in OS keychain, SSRF-guarded AI HTTP.

**Three app surfaces** (three Vite HTML entries + React roots):
- `index.html` → main window (`src/app/App.tsx`)
- `settings.html` → settings window (`src/settings/main.tsx`)
- `remote.html` → remote-access UI (`src/remote/main.tsx`)

## 3. What this repo is NOT

- Not a web app — it is a desktop app; `vite dev` on port 1420 is the shell only.
- Not a monorepo — `pnpm-workspace.yaml` has one package, the app itself.
- Not stateless — workspaces and pane launch plans persist in SQLite (Rust),
  preferences in a Tauri `LazyStore`, API keys in the OS keychain.
- The directory is `terax-ai` but the product is **cmdSpace** (branding is
  mid-rename; code says `cmdspace`, identifier `app.tranhoangpich.cmdspace`).

## 4. Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite 7, TypeScript 5.8, Tailwind CSS v4 (`@tailwindcss/vite`) |
| State | Zustand 5 (prefs, chat, env) + top-level `useState` in `App.tsx` for tabs/workspaces |
| Terminal | xterm.js 6 (WebGL renderer) + renderer pool + PTY bridge |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`), vim mode |
| AI | Vercel AI SDK v6 (`ai` + `@ai-sdk/*` providers) |
| UI kit | shadcn/ui (Radix) — 41 components in `src/components/ui/` |
| Backend | Tauri 2, Rust (edition 2021), `portable-pty` 0.9, `rusqlite` (bundled), `keyring`, `tungstenite`, `reqwest` (rustls) |
| Styling | Tailwind v4 tokens in `src/styles/globals.css` (`@theme inline`, shadcn vars) |
| Icons | `@hugeicons/react`, `@iconify-json/catppuccin` |
| Test | Vitest (node env, no separate config) + inline Rust `#[cfg(test)]` |

## 5. Architecture at a glance

```
┌──────────────────────────── webview (React) ─────────────────────────────┐
│  App.tsx  ── useTabs (tabs + pane tree) ── TerminalStack / EditorStack   │
│     │                          │                                         │
│     │  invoke()                │  imperative handles (term/editor refs)  │
└─────┼──────────────────────────┼─────────────────────────────────────────┘
      ▼                          ▼
┌───────────────────────────── src-tauri (Rust) ───────────────────────────┐
│  lib.rs  (~110 commands, managed state, plugins)                         │
│  modules: pty/ shell/ fs/ git/ secrets/ speech/ remote/ net/ db/         │
│           workspace/ agent_usage/ music/ proc/                           │
│  PtyState (RwLock<HashMap<u32, Session>>) · WorkspaceRegistry (auth)     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Two-process rule:** every FS/process/shell touch is a Rust command. New
commands are added in `lib.rs::run()` via `invoke_handler` + a capability in
`src-tauri/capabilities/`.

## 6. Frontend module map

All feature modules live in `src/modules/<name>/`, each with a barrel
`index.ts` and hooks under `lib/`.

| Module | Purpose | Key entry |
|---|---|---|
| `tabs/` | Tab + pane-tree state machine (all tab kinds) | `lib/useTabs.ts` |
| `terminal/` | Standard terminal: xterm pool, PTY bridge, OSC, IME | `lib/pty-bridge.ts`, `TerminalStack.tsx` |
| `architecture/` | Infinite-canvas diagram with live terminal nodes | `ArchitectureCanvas.tsx`, `CanvasTerminalNode.tsx` |
| `ai/` | Chat store, transport, agent registry, tools, voice | `store/chatStore.ts`, `lib/native.ts` |
| `editor/` | CodeMirror editor, git/AI diffs | `EditorStack.tsx` |
| `explorer/` | File tree sidebar | `FileExplorer.tsx` |
| `preview/` | In-app browser preview tabs | `PreviewStack.tsx` |
| `markdown/` | Markdown preview tabs | `MarkdownStack.tsx` |
| `git/` + `git-history/` | Git event bus + commit graph | `events.ts`, `GitHistoryPane.tsx` |
| `source-control/` | Git status panel + app-wide hook | `SourceControlPanel.tsx`, `useSourceControl.ts` |
| `header/` / `statusbar/` / `sidebar/` | Chrome | `Header.tsx`, `StatusBar.tsx`, `SidebarRail.tsx` |
| `workspaces/` / `workspace/` | Left rail + env (local/WSL) scope | `WorkspacesPanel.tsx`, `env.ts` |
| `settings/` | Preferences store (LazyStore) + window | `preferences.ts`, `store.ts` |
| `shortcuts/` | Global shortcut engine | `useGlobalShortcuts.ts` |
| `theme/` | Themes + liquid-glass blur + bg image/video | `ThemeProvider.tsx` |
| `updater/` | Auto-update dialog | `useUpdater.ts` |

**The one rule:** `src/app/App.tsx` coordinates workspace/tab/pane state and
threads it down via props. Feature components do not duplicate that state.

## 7. Rust command map

All commands are registered in `src-tauri/src/lib.rs`. The frontend talks to
them through three clients:

- `src/modules/ai/lib/native.ts` — the de-facto IPC client: FS (`fs_*`), shell
  (`shell_*`), git (`git_*`), workspace (`workspace_*`). Nearly every call
  passes `workspace: currentWorkspaceEnv()`.
- `src/modules/terminal/lib/pty-bridge.ts` — PTY: `pty_open/write/resize/close/
  register_metadata/list`, streaming raw bytes via `Channel<ArrayBuffer>`.
- Ad-hoc invokes in `App.tsx` / modules: `db_*` (SQLite workspaces/panes),
  `secrets_*` (keychain), `remote_access_*`, `speech_*`, `music_*`, `net_*`
  (AI HTTP proxy), `agent_usage_statuses`, `wsl_*`.

Backend modules under `src-tauri/src/modules/`: `pty/`, `shell/`, `fs/`,
`git/`, `secrets.rs`, `speech.rs`, `remote.rs` (+ `remote_auth/_protocol/
_tunnel`), `net.rs`, `db.rs`, `workspace.rs`, `agent_usage.rs`, `music.rs`,
`proc.rs`.

## 8. Terminal subsystem

Deep dive: [`docs/architecture/terminal-input-pipeline.md`](docs/architecture/terminal-input-pipeline.md).
Architecture decisions: [`docs/adr/`](docs/adr/README.md).

**Standard terminals** (`src/modules/terminal/`):
- `pty-bridge.ts` → `pty_open` spawns a native shell via `portable-pty`,
  `on_data` streams raw bytes (4 ms coalescing flusher, 4 MiB overflow cap).
- `rendererPool.ts` — a **fixed pool of 12 xterm instances** in an off-screen
  recycler. Switching panes rebinds an existing terminal (snapshot + dormant
  ring replay) instead of creating/destroying — the key perf trick.
- `useTerminalSession.ts` — sessions are `Map<leafId, Session>` living at
  module level, surviving React remounts. `inputBuffer`/`agentLaunchBuffer`
  track the prompt for CLI-agent detection.
- `osc-handlers.ts` — OSC 7 (cwd) + OSC 133 (prompt markers, `inCommand` state;
  ignores cwd updates while in command because command output is untrusted).
- `macImeBridge.ts` — macOS IME composition → PTY diff writer. **Normalizes
  C1/NBSP space corruption** (`normalizeMacTerminalInput`) and diffs both sides
  of the textarea to avoid spurious DEL. See the history of #81/#82.
- `keymap.ts`, `panes.ts`, `BottomTerminalDrawer.tsx` (Cmd+I drawer), and
  `PaneTreeView.tsx` (recursive pane tree with floating per-pane overlay).

**Canvas terminals** (`src/modules/architecture/CanvasTerminalNode.tsx`):
- Each node owns a **private xterm instance + its own PTY** via the same
  `openPty`. No renderer pool, no shared instances.
- The terminal world is an HTML layer transformed with
  `translate3d(...) scale(scale)` — CSS transforms don't trigger ResizeObserver,
  so camera zoom never fires PTY resizes.
- PTY lifecycle is tied to node mount/unmount; cwd flows back into the diagram
  and persists into the workspace `paneLayout`.
- **Do not route canvas terminals through `TerminalPane`/the pool.**

## 9. Persistence model

| Concern | Mechanism |
|---|---|
| Workspaces + pane launch plans | SQLite (Rust `db.rs`), `db_*` invokes |
| Preferences | Tauri `LazyStore` (`cmdspace-settings.json`) + Zustand mirror, cross-window via `cmdspace://prefs-changed` |
| AI chat sessions | `LazyStore` `cmdspace-ai-sessions.json`, scoped by workspace |
| API keys | OS keychain (`secrets.rs`) |
| Chrome/UI state | `localStorage` (namespaced keys in `src/app/constants.ts`) |
| Live terminal sessions | In-memory only (die with the app) |
| Canvas diagrams | Serialized into workspace `paneLayout` → SQLite |
| Window state | `@tauri-apps/plugin-window-state` |

Tabs themselves are **not** persisted across restarts — only workspaces and
pane launch plans are.

## 10. How to add a feature

1. Read `CMDSPACE.md` + this plan's module map. Find the owning module.
2. Frontend logic goes in that module under `src/modules/<name>/`; if a new
   privileged op is needed, add a Rust command in `src-tauri/` + register it in
   `lib.rs::run()` (`invoke_handler`) and add the capability permission.
3. Keep the two-process contract: no FS/shell access from the webview.
4. Follow `AGENTS.md` rules (no file deletion without permission; no destructive
   git commands; conventional commits; GitHub delivery via
   `docs/AGENT_GITHUB_DELIVERY.md`).
5. Verify: focused Vitest + `pnpm build`; for Rust changes also
   `cd src-tauri && cargo check --all-targets --locked` (clippy `-D warnings`
   when practical).

## 11. How to debug

- **Frontend**: Vitest (`pnpm test`), co-located `*.test.ts(x)` next to source,
  plus `*.source.test.ts(x)` that assert on source text as regression guards.
- **Rust**: inline `#[cfg(test)]` + standalone `*_test.rs` modules;
  `cd src-tauri && cargo test`.
- **Terminal input bugs (IME/C1/NBSP)**: log with **hex dumps** at the PTY
  boundary (`writeToSessionPty`) — `JSON.stringify` visually collapses C1
  (0x80–0x9F) and NBSP (0xA0) into plain spaces and will mislead you. See the
  history of issues #79/#81 for the exact technique.
- **CI**: `.github/workflows/ci.yml` runs tsc + build + cargo check/clippy.

## 12. How to ship

Follow [`docs/RELEASE_RUNBOOK.md`](docs/RELEASE_RUNBOOK.md) exactly:

1. Release issue `chore(release): publish vX.Y.Z`
2. Branch `chore/<N>-release-v0-7-XX`
3. Bump 4 files (`package.json`, `Cargo.toml`, `Cargo.lock`, `tauri.conf.json`)
4. Conventional commit with `Tested:` trailer
5. Verify (`tauri.conf.test.ts`, `pnpm build`, `cargo check`)
6. PR with `Closes #<issue>`, merge
7. Tag `vX.Y.Z` → GitHub Actions builds + uploads installers (macOS signed/
   notarized, Windows, Linux) + `latest.json`
8. Confirm run success + release assets

## 13. Known gotchas

- **React 19 strict mode double-spawns PTYs in dev** — expected, not a bug.
- **macOS IME**: WebKit can surface spaces as C1 controls or NBSP; normalize at
  the IME boundary (`normalizeMacTerminalInput`), not in CLI scripts.
- **Windows**: ConPTY needs the Job Object (`pty/job.rs`) + a global
  `CONPTY_LIFECYCLE_LOCK`; `pty_close` drops on a detached thread.
- **Path normalization**: use `.split(/[\\/]/)`; canonical form is
  forward-slash on the frontend.
- **xterm `_inputEvent`** can double-fire data when `input` arrives after
  `keyup`; the pool guards with `shouldIgnoreMacPrintableTerminalData`.
- **OSC color reports** (`OSC 10/11`) arrive on the input channel — strip them
  or they corrupt zsh history recall.

## 14. Backlog & open issues

See `ROADMAP.md` for the shipped/planned matrix. Known open items:
- SSH support, terminal auto-suggestions, meta-orchestration of external agents.

## 15. Risks & open questions

- **Branding drift**: repo/bundle say `cmdSpace`, docs say `Terax-AI` — decide
  the canonical name and migrate.
- **IME bridge fragility**: the textarea-diff heuristic is the most delicate
  code; a jsdom/happy-dom integration test suite would harden it.
- **Terminal session loss**: live sessions are in-memory only; a session-restore
  story (beyond pane launch plans) is an open product question.
- **`docs/ARCHITECTURE.md` + `docs/GLOSSARY.md` are stale** (Harness template
  boilerplate) — `CMDSPACE.md` is authoritative.
