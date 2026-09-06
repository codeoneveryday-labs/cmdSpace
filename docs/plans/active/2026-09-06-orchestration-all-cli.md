# Orchestration for every CLI agent (manual PTY loop)

## Outcome

Any of the 47 CLI agents in `CLI_AGENT_IDS` can be orchestrator or worker on an
Orchestration Canvas. The 6 CLIs with structured transports
(codex/claude/cmd/gemini/opencode/omp) keep the current autonomous worker loop.
All other CLIs run as **manual PTY workers** (munder-difflin style): the panel
shows launch command + worktree cwd + worker prompt, the human runs the CLI in
any Canvas terminal, then marks the task complete from the review list.

## Context

- Prior turn opened orchestration 3 -> 6 providers (structured transports).
- BE already has `agent_chat` adapters for exactly those 6
  (`providers/mod.rs::profile`), plus file-mailbox infra
  (`orchestration/mailbox.rs`, `router.rs`, `orchestration_mail_*` commands).
- FE `CLI_AGENT_DEFINITIONS` is missing `chatTransport` for gemini/opencode
  even though BE adapters exist -> FE/BE mismatch fixed in this plan.
- `OrchestrationCanvasPanel` has no terminal-spawn seam, so auto-spawning PTY
  workers is explicitly out of scope; manual loop closes the cycle instead.

## Approach

1. FE catalog becomes source of truth: add `gemini-stream-json` /
   `opencode-json` transports, tag gemini/opencode defs.
2. `OrchestrationProvider = CliAgent`; `ORCHESTRATION_PROVIDERS =
   CLI_AGENT_IDS`; manifest validation checks catalog membership.
3. BE: `AgentSpec.provider` / `OrchestratorSpec.provider` become `String`
   (provider-agnostic coordination; launch resolution stays at worker start).
4. `startReadyTasks` branches on `chatTransport`: structured -> current
   agent_chat path; manual -> prepare worktree, record manual entry, skip
   bind. Manual entries rebuild from persisted `worktreePath` on reattach.
5. Panel review list gains per-task Complete control for running tasks.

## Risks

- String providers weaken compile-time exhaustiveness; mitigated by catalog
  validation test over all 47 ids.
- Manual tasks depend on human completion; tasks stay `running` (visible)
  rather than failing silently.

## Recovery

Revert commits in order; manifests with 6 structured providers parse both
before and after (plain JSON strings).

## Progress

- [x] Plan written.
- [x] FE catalog transports + orchestration types/validation/UI/prompts.
- [x] BE String migration + tests.
- [x] Manual worker branch + Complete control.
- [x] Verify: tsc, vitest (orchestration + cliAgents), cargo check/test, build.

## Decisions

- Manual-first for unstructured CLIs (no auto-spawn seam yet).
- `OrchestrationProvider` aliases `CliAgent` (single catalog, no parallel list).
- Structured-first sort in setup UI; full list shown.
- 2026-09-06 (hive files follow-up, munder-difflin style): per-run bundle
  `PROTOCOL.md/registry.json/board.md/tasks.json/agents/<id>/{identity.md,memory.md}`
  under `~/.cmdspace/orchestration/<run>/` (next to the mailbox `agents/`).
  Runtime + SQLite stay the writers; files are a read view, synced best-effort
  inside `persist_run` (one hunk, covers every transition). `memory.md` is
  create-once, never clobbered. Inbox reads self-drive delivery
  (`deliver_pending_mail` shared with the route command, no event spam) so CLI
  file-writers need no Tauri calls. Manual worker prompt points at concrete
  hive paths. Coordination: `mailbox.rs/router.rs/wake.rs/launch.rs` and the
  resume/retry admit blocks are the other agent's area
  (`2026-09-06-orchestration-mailbox-router.md`) — this slice only appends
  `hive_files`, one import, `persist_run`, and the inbox/route extraction.
- 2026-09-06 (boss-assigns loop, toolbar-native per HEAD `8d0e90d04`): run
  lifecycle without a side panel — `useCanvasOrchestrationRun` (snapshot +
  attach, start/save-draft/approve/complete/retry) wired in
  `ArchitectureCanvas`, surfaced as `OrchestrationToolbarSection` inside
  `CanvasToolbar` (optional prop, non-orchestration canvases untouched).
  `workspaceId/workspaceCwd` re-destructured (Stack still passes them).
  Runtime is created lazily (Tauri Channel needs window; keeps SSR render
  tests green). Worker spawn stays in `useCanvasOrchestrationWorkers`.
  Open: Boss-proposed drafts (toolbar uses local `createOrchestrationDraft`;
  Boss CLI revision comes later), prompt injection into spawned CLIs.
- 2026-09-06 (prompt handoff): spawned worker briefs are typed into the CLI
  prompt via registered terminal handles (`tryDeliverWorkerPrompt`, polled at
  750ms for ~60s, dropped when the node closes). Never presses Enter —
  submitting stays human/Boss. Pure helpers tested; hook wiring source-tested.
- 2026-09-07 (spawn-requests, joint with BE agent): Boss asks for ad-hoc
  helpers by writing JSON into `<run>/spawn-requests/` (schema in PROTOCOL
  step 6). New `spawn_queue.rs` (list/claim, traversal-guarded, garbage never
  claimed) + `orchestration_spawn_list/claim` commands (registered). Canvas
  workers hook polls per reconcile, spawns `orchestration-spawn-<id>` terminal
  nodes (no task binding), injects the objective via the prompt timer, claims
  on success. Note: also added the missing `protocol` import in commands.rs —
  the BE agent's tree was mid-flight and didn't compile without it.
- 2026-09-06 (boss-assigns follow-up): HEAD `8d0e90d04` removed the side panel
  (Boss terminal is the only interaction surface, enforced by source test), so
  the panel console (manual/mailbox/complete) is parked, not deleted. Workers
  auto-spawn as Canvas terminal nodes via `useCanvasOrchestrationWorkers`
  (additive hook, no terminal-subsystem changes, panel-ban test stays green).
  Prompt handoff into spawned CLIs + toolbar complete controls remain open;
  worker `initialCommand` is the bare CLI launch, matching the Boss seed
  precedent.

## Validation

- `pnpm exec tsc --noEmit`
- `pnpm vitest run` on orchestration + cliAgents + workspace setup tests
- `cargo check --all-targets --locked`, `cargo test --locked orchestration`
- `pnpm build`
