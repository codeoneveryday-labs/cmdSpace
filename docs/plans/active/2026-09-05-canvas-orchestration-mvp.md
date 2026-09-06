# Canvas Orchestration MVP

## Outcome

Canvas is the only workspace mode that can host orchestration. Existing
Architecture Canvas workspaces remain diagram-first, while a new orchestration
Canvas template adds an approved task graph backed by a native deterministic
scheduler. Standard and Agent Chat workspaces remain unchanged.

## Locked product decisions

- The orchestrator proposes a graph; the user edits and approves an exact
  revision before any worker or worktree starts.
- Orchestrator, agent, and task are separate semantic nodes.
- MVP workers are Codex, Claude, and Command Code only.
- Worker traffic routes through the orchestrator; peer messaging is deferred.
- Writable tasks use dedicated worktrees. At most three tasks run concurrently,
  and each agent runs at most one task.
- Results stop on an internal integration branch for review. Nothing merges into
  the user's branch and no worktree or branch is automatically deleted.
- Restart marks active work interrupted and requires an explicit resume.

## Architecture and pattern seams

- **Composite + Memento:** Canvas persists layout plus stable orchestration
  bindings, never live processes or runtime handles.
- **State + Command:** Rust owns run/task transitions and the
  `orchestration_*` command surface.
- **Observer:** one Canvas attachment receives replay/live run events; an
  internal Agent Chat observer remains independent of UI attachment lifetime.
- **Adapter + Bridge + Proxy:** existing provider adapters, Tauri IPC,
  workspace authorization, shell, and Git seams remain the only native paths.
- **Facade + Mediator:** `ArchitectureCanvas` coordinates presentation while a
  deep orchestration module owns policy and execution.

## Phases

- [x] Phase 0: document contracts and protect legacy Canvas hydration.
- [x] Phase 1: add orchestration Canvas template, semantic graph model,
      validation, editing, and draft UI without execution.
- [x] Phase 2: add native runtime, SQLite persistence, replay, and internal
      Agent Chat lifecycle observation.
- [~] Phase 3: add tagged proposal parsing, revision editing, and approval gate.
      Tagged proposal, direct revision editing, and stale approval are
      implemented; feedback-driven Orchestrator revision is not yet wired.
- [~] Phase 4: add deterministic worker scheduling, worktrees, validation, and
      internal integration branch handling. Core runtime behavior is present;
      fake-provider/Git/shell integration fixtures remain follow-up coverage.
- [~] Phase 5: add review surface, interruption recovery, provider smoke
      coverage, and full regression proof. Basic branch/status review and
      restart-to-interrupted recovery are present; packaged provider smoke and
      a full diff/accept-reject review UI remain follow-ups.

## Verification

- Focused Vitest and Rust tests are added test-first for every behavior.
- Frontend: `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`.
- Native: `cargo fmt --all -- --check`, `cargo test --all-targets --locked`,
  `cargo check --all-targets --locked`, and
  `cargo clippy --all-targets --locked -- -D warnings`.
- Manual packaged smoke: Codex, Claude, Command Code; Canvas detach/reattach;
  restart-to-interrupted; final review branch leaves the working branch intact.

## Progress

- 2026-09-05: created isolated branch `codex/canvas-orchestration-mvp` from
  `v0.7.104`. Baseline frontend (1,271 tests) and relay (6 tests) pass. Rust
  baseline is compiling in the fresh worktree.
- 2026-09-06: implemented Canvas-purpose metadata/templates, semantic
  orchestration graph projection, manifest validation/proposal parsing, native
  scheduler and SQLite run/task/event persistence, worktree creation and
  internal branch integration, validation/failure/blocking transitions,
  provider session binding, startup interruption recovery, runtime event
  replay, and an internal Agent Chat event observer. Verification: 480
  frontend test files / 1,289 tests, relay 6/6,
  focused Rust orchestration tests 11/11, TypeScript build, Vite build,
  `cargo check`, and warnings-denied Clippy pass.
- 2026-09-06: updated Canvas Orchestration setup with an explicit single
  Orchestrator CLI selection. Codex and Claude Code are recommended, Command
  Code remains supported, and the selected provider is persisted into the
  orchestration Canvas metadata instead of defaulting silently to Codex.
