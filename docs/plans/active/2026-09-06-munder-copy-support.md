# Support Plan: Copy munder-difflin Coordination

Date: 2026-09-06

## Status

Active

## Outcome

CLI workers on an Orchestration Canvas behave like munder-difflin hive agents:
they wake knowing who they are, drain their inbox, write to outboxes, and
remember across tasks — without copying anything Electron-specific and without
colliding with the two agents owning the panel/catalog/worker-start.

## Copy Status Map

| # | Munder mechanism | Terax status | Owner |
|---|---|---|---|
| 1 | Mailbox files (inbox/outbox/.done/cursor) | Done BE (`mailbox.rs`); FE client done (`orchestrationRuntime.ts` mail fns) | me / canvas-agent |
| 2 | Router outbox→inbox + FIPA-lite schema/hops | Done BE (`router.rs`); panel Route button done | me / canvas-agent |
| 3 | Boss as real CLI terminal | Done (canvas terminal + badge, single surface) | prior work |
| 4 | Launch bin/argv + auto flags; catalog owns flags | Mechanics done (`launch.rs`); flags in `cliAgents.ts` | me / canvas-agent |
| 5 | Manual PTY workers + Complete control; 47-CLI catalog | Done (panel + `cliAgents.ts` + String providers) | canvas-agent |
| 6 | **Spawn protocol pack** (identity.md, PROTOCOL.md, worker protocol block, Boss orientation, 4-part dispatch) | **Missing — biggest gap** | **S1 (me: files+commands; them: 2 call sites)** |
| 7 | Inbox drain instruction in worker prompt (no-hook interim) | Missing, 5-line FE change | S1b (them) |
| 8 | Wake typer + periodic beat | Policy done (`wake.rs`); typer/beat missing | S2 (joint w/ PTY owner) |
| 9 | Stop-hook autonomous drain loop | Missing; no hook infra in `agent_chat` at all | Later (agent_chat owner) |
| 10 | God adjudication (`to:human` routing, heartbeat standups) | Missing | Later |
| 11 | Memory (per-agent memory.md, shared board scribe) | Missing; needs S1 first | Later |
| 12 | Circuit breaker + budgets | Missing | Later |

Explicitly NOT copied: `roster.json` localStorage lesson (SQLite already
durable, single Tauri origin), Slack/webhooks, MemPalace, voice, pixel art —
different product, no value.

## Slices

### S1 — Spawn protocol pack (next, mine)

New `orchestration/protocol.rs` (pure, tested): given a run manifest + agent
id, render `identity.md` (who am I, role, provider, task, worktree, mailbox
paths) and the shared run `PROTOCOL.md` (inbox/outbox rules, ack-to-.done,
single-writer rule, act/hops semantics, 4-part dispatch contract for the
Boss). Two additive commands: `orchestration_agent_identity(run_id,
agent_id)` (ensure files on disk under the run agent dir, return texts) and
`orchestration_run_protocol(run_id)` (ensure + return shared PROTOCOL.md).

Integration (theirs, 2 call sites in `startReadyTasks`): structured branch
passes the identity text into the worker session start; manual branch shows it
alongside launch/cwd/prompt (same card as today). I do not touch the panel.

Acceptance: `cargo test --locked orchestration` green; identity text names
the agent/task/worktree/inbox; PROTOCOL.md matches mailbox semantics.

### S1b — Drain instruction (theirs, trivial)

Append 2 lines to `workerPrompt()` (`orchestrationWorkerPrompt.ts`): read
inbox first via `loadInbox`, file handled mail via ack (maps to `.done/`).
No-hook interim until S9. Zero BE involvement.

### S2 — Wake beat (joint with PTY owner, after S1)

Needs: `last_output_at` on live `Session` publish path (PTY subsystem file —
their call), agent-to-PTY binding (candidate: extend `bind_task_session` with
optional PTY id, or a tiny new command), then a beat calling
`orchestration_wake_decide` + `pty_write` nudge + Enter. Policy, types, and
commands already exist. Do not start before the PTY owner agrees on the
timestamp seam.

## Risks And Recovery

- Panel `startReadyTasks` is under active edit: S1 ships BE-only first;
  call-site wiring is a 5-line patch they apply when ready. No overlapping
  hunks by construction.
- Boss prompt (panel line ~860) stays theirs; S1 protocol text must not
  contradict it — S1 reuses the same provider list source (`CLI_AGENT_IDS`).
- Rollback per slice: new files + additive commands only.

## Validation

- Per slice: focused Rust tests + `cargo test --locked orchestration`,
  `cargo clippy --all-targets --locked -- -D warnings`,
  `cargo fmt --all -- --check`, `git diff --check`.
- FE call sites (S1b, S1 wiring): their `tsc` + focused Vitest.
- No packaged-CLI smoke claimed until S2.

## Progress

- [x] Status map + slice order agreed (this file).
- [x] S1 protocol identities — MERGED with canvas-agent's `hive_files.rs` (see Result).
- [x] Boss orientation + worker memory lines (protocol.rs) + tests.
- [x] Shared memory recall via SQLite FTS5 (`memory.rs` + schema + 2 commands) + tests.
- [x] S1b drain lines (canvas-agent).
- [x] A: cursor read for real (`load_cursor`, `unread_ids`, `orchestration_mail_unread`).
- [x] B-BE: server-side hops derive + unknown-parent error (`find_message`).
- [x] B-FE: Reply button + thread prefill + unread badge + `sendMail` reply fields.
- [x] C: board 2-section (markers + preserved freeform) + `orchestration_board_note` + marker sanitizing.
- [ ] S2 beat (joint, blocked on PTY timestamp seam).

## Result (S1, same day)

Mid-implementation the canvas-agent landed `orchestration/hive_files.rs` in
the same tree: auto-sync bundle on every `persist_run` writing
`PROTOCOL.md` / `registry.json` / `tasks.json` / `board.md` /
`agents/<id>/{identity.md,memory.md}` into the same run dir as my mailbox —
colliding on TWO paths (`PROTOCOL.md`, `identity.md`) with different content,
and their tree didn't compile yet (missing `mod` decl, unqualified
`hive_files::` path from `commands.rs`, `{name}` binding removed by the
identity swap). Merged instead of duplicating:

- Their bundle OWNS all on-disk files (superior lifecycle: auto-sync).
- My `protocol.rs` OWNS the identity renderer (rich: assignment, worktree,
  absolute mailbox paths, Boss roster+policy); their sync calls
  `protocol::render_identity` per member. My parallel `render_protocol` /
  `ensure_protocol` / `orchestration_run_protocol` were deleted — their
  `PROTOCOL_MD` covers the bundle layout mine didn't know.
- I added the missing `mod hive_files` decl, the `super::hive_files` import,
  and fixed the `{name}`→`{member}` breakage from the swap. Their 3 bundle
  tests pass unmodified through my renderer.
- Kept: `orchestration_agent_identity` (on-demand rich identity + path).

Open for them (not mine to decide): their PROTOCOL step 4 says inbox
delivery is "automatic on the next inbox read" — our mechanics need an
explicit route (`mail_route` / panel Route button / future auto-route).
Either wire auto-route on send or reword the step.

### Auto-delivery convergence (same day, both sides)

Resolved without a meeting: the canvas-agent refactored my route body into
`deliver_pending_mail(run)` and wired it into `orchestration_mail_inbox`
(self-driving delivery on every read, silent, idempotent). I wired the same
helper best-effort into `orchestration_mail_send` (send now delivers;
`auto_routed`/`auto_skipped` reported in the sent event; route failure never
fails the send). Their documented promise is now mechanically true on both
paths. Panel's explicit send→route→refresh flow is unaffected (second route
is a no-op).

Tree-wide verification (all three agents' work together): full
`cargo test --locked --lib` 361 pass, `pnpm exec tsc --noEmit` clean,
orchestration 44/44, db 10/10, clippy/fmt/diff clean.

### Slices A/B/C (same day, approved plan, all three done)

- **A (BE, mine):** cursor is load-bearing — `load_cursor`,
  `unread_ids` (inbox membership IS unread; cursor names last ack),
  `orchestration_mail_unread`. Router dedup stays single-sourced on the
  `.done/` scan by design.
- **B-BE (mine):** `find_message` across inbox/.done/outbox;
  `mail_send` derives `hops = parent.hops + 1`, inherits conversation,
  errors on unknown parent, still capped at MAX_HOPS.
- **B-FE (mine, user-overrode lanes):** Reply button per message, thread
  banner + cancel, `sendMail` optional reply fields (backward compatible),
  unread badge, identity switch clears reply. tsc + 7 vitest green.
- **C (mine + their bundle):** board split — auto block between
  `cmdspace:board:auto` markers regenerated every sync, freeform outside
  preserved (markerless files kept wholesale); `append_board_note`
  (attributed, 4 KiB cap, marker sanitizing) + `orchestration_board_note`
  command + TaskActivity event; shared `task_ledger` helper removes the
  duplication the split introduced. Their PROTOCOL wording updated to the
  new contract.
- Verified: 53/53 orchestration tests, clippy/fmt/diff clean, tsc clean,
  focused vitest 7/7.

### Resurvey 2026-09-06 (other agents + remaining munder surface)

Their progress since last check: `OrchestrationToolbarSection` (toolbar
controls, explicitly no chat surface — respects the lock), `workerPrompt`
drain lines (S1b done), `useCanvasOrchestrationRun/Workers` hook split,
`orchestrationRuntime.test.ts` coverage. Their "automatic on next inbox
read" wording is now mechanically TRUE (inbox-read delivery), so that open
question closes — no reword needed.

Remaining munder surface worth copying, ranked:

1. **Per-transport lifecycle bridges (S9 pathfinder, biggest unlock).**
   Munder doesn't need generic hooks: `hookBridge` presets per provider —
   claude native `--settings`, codex via `CODEX_HOME` reusing the Claude
   shim verbatim (payloads already Claude-shaped), agy via translating
   `hooks.json` shim, grok via camelCase adapter, plus
   `bridge:{kind:'hooks'}` presets for opencode and pi/omp. That covers 5
   of our 6 structured transports (codex/claude/gemini/opencode/omp);
   only house `cmd` is unmapped. The Stop-drain loop therefore needs
   per-transport shim installers, not a generic hook system — much smaller
   than assumed. Needs agent_chat owner to confirm transport-side hooks.
2. **Breaker policy core (copyable pure, waiting on inputs).** `breaker.ts`
   is side-effect-free: healthy→steering→constrained→stopped, one level
   per beat, de-escalate on healthy, hardStop OFF, velocity as diff of
   cumulative samples, action fires only on escalation. Deliberately NOT
   copied yet: terax has no per-agent usage-velocity signal, and policy
   without inputs is speculative code. Revisit when `agent_usage` (or
   agent_chat transcripts) yields per-agent samples.
3. **Message-queue contract (design input for S2 beat).** Single drain
   loop owns every "is the prompt free?" decision (idle, boot grace,
   automation-safe/draft/picker, 4.5s gap); nudge never writes straight to
   PTY (garbled-prompt incident); manual release bypasses pause only.
   `WakeFacts` already carries paused/halted/delivery_paused — aligned.
4. **ControlRegistry shape (no action).** pause/steer/halt riding hook
   returns — mechanism needs hooks (see 1); state shape already mirrored.
5. **God boot exception.** Orientation typed directly at spawn inside boot
   grace — terax equivalent is `initialCommand`; no change needed.

Not copying, confirmed: avatar/station Pixi, Slack, MemPalace, Gallery,
roster.json lesson, voice-floor, cost ledger (no billing surface here).

### HIVE.md audit 2026-09-06 — ~60% copied, honest ledger

Copied whole: single-writer-per-file, atomic one-JSON-per-message, router
flow, FIPA-lite schema shape, hop cap, append-only event log (SQLite not
jsonl), worktree isolation, launch mechanics, wake policy, identity/memory
scaffolding, board/tasks/registry as read views.

Partial (mechanism present, behavior missing): cursor.json is
WRITE-only (router dedupes via `.done/` scan instead); `conversation` /
`in_reply_to` accepted but FE always sends null (no threading); hops capped
but never incremented (no reply path); board.md derived, no scribe;
memory mined+searchable BE-only, no UI; Boss orientation exists, no
autonomous adjudication / `to:human` / heartbeats.

Not copied: Stop-hook drain loop (no hook infra), god-mode autonomy +
native HITL (opposite product philosophy — terax gates on approvals,
deliberate), reflection/summarization (open in munder too), ASK ME/humanQA
cards, breaker enforcement, wake beat typer.

Never copy: god-autonomy-over-approvals (would violate terax's reviewable-
edits contract); Electron-only lessons.

Verified: 42/42 orchestration tests (theirs + mine together), clippy
`-D warnings` clean, fmt + diff-check clean.

### Boss orientation + memory recall (same day, mine)

- `render_orchestrator_identity` gained Awareness (read registry/tasks/board/
  memories/inbox; interrupted-after-restart caution) and Delegate
  (existing-agent-first, 4-part contract, scheduler bounds) sections —
  terax-flavored, no fleet.json/registry.json fiction. Worker identity gained
  `memory.md` read/append steps plus its absolute path (file exists via the
  hive bundle, so the promise is honest).
- `orchestration/memory.rs`: `orchestration_memory_fts` FTS5 table
  (`run_id/agent_id/source` unindexed, porter tokenizer) created in
  `initialize_schema` next to the other orchestration tables;
  `index_run_memories` mines `agents/*/memory.md` + `board.md` with
  content-hash skip; `search_memories` with snippet + rank + run scoping.
  Decisions: keyword FTS over vectors (scale + zero new deps); no auto
  reindex trigger — explicit `orchestration_memory_reindex` command, panel
  calls it when useful. Malformed MATCH returns a named error, never silent
  empty. No FE: search UI stays canvas-agent's lane.
- Verified: 44/44 orchestration tests, 10/10 db tests, clippy/fmt/diff clean.
