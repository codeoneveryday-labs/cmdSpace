# Execution Plan: Capability-aware orchestration delivery

Date: 2026-09-07

## Status

Active — planning only; implementation has not started.

## Outcome

Make Canvas orchestration route worker mail according to each provider's actual
delivery capability, report the authoritative outcome of every route, and keep
the existing wake/breaker runtime while expanding its regression matrix.

A worker message must never be recorded or animated as delivered merely because
the router accepted the request. The system must distinguish direct inbox
delivery, terminal handoff, proxy delivery, bounce, and drop with a reason.

## Context and authority

Authoritative project rules:

- The React webview uses the existing Tauri Bridge; no parallel privileged IPC.
- `src/modules/terminal/lib/cliAgents.ts` is the frontend CLI catalog authority.
- `src-tauri/src/modules/orchestration/` owns native orchestration state,
  mailbox delivery, routing, worker launch, wake, breaker, and persistence.
- `src/modules/architecture/lib/` owns Canvas orchestration presentation and
  event-to-visual projection.
- Existing Rust refactor work is active in
  `docs/plans/active/2026-09-07-orchestration-rust-refactor.md`; capability
  delivery must wait until ownership of the command facade/runtime seams is
  settled or be explicitly rebased onto its final files.

Relevant current seams:

- `src-tauri/src/modules/orchestration/model.rs` — serializable provider,
  manifest, task, and event models.
- `src-tauri/src/modules/orchestration/mailbox.rs` — mailbox files, cursors,
  atomic delivery, unread state, and hop limits.
- `src-tauri/src/modules/orchestration/router.rs` — pending-mail route planning
  and route reports.
- `src-tauri/src/modules/orchestration/command_support.rs` and
  `commands_impl.rs` — shared delivery adapters and Tauri command behavior.
- `src-tauri/src/modules/orchestration/protocol.rs` — worker identity and
  mailbox instructions injected into CLI workers.
- `src-tauri/src/modules/orchestration/wake.rs` and `breaker.rs` — existing
  wake/breaker policy cores; this plan adds coverage, not a new runtime.
- `src/modules/architecture/lib/orchestrationRuntime.ts` and
  `useCanvasOrchestrationRun.ts` — frontend runtime facade and event state.
- `src/modules/architecture/lib/orchestrationMailFlights.ts` — mail route
  events projected into Canvas animation.

External pattern reference:

- Munder Difflin's `HIVE.md` and `src/main/hive.ts` use capability-aware
  delivery, atomic outbox/inbox files, hop caps, bounce paths, and explicit
  route outcomes. This plan adapts those ideas to cmdSpace's Tauri/Rust and
  SQLite architecture; it does not import Electron, Pixi, or its runtime.

## Scope

In scope:

- Define a small delivery capability contract for orchestration workers.
- Derive the capability from the existing CLI catalog at manifest/worker
  creation time, without creating a second frontend provider table.
- Add a safe native fallback when a worker cannot drain a mailbox directly.
- Make route reports and persisted `MailRouted` events outcome-aware.
- Make Canvas mail animation represent only accepted/delivered routes and expose
  failed or bounced routes as state that can be inspected/retried.
- Add focused tests for capability selection, route outcome classification,
  legacy manifests, provider fallbacks, and the existing wake/breaker edge cases.

Out of scope:

- Replacing the existing wake or circuit-breaker algorithms.
- Adding Computer Use, browser automation, a new MCP server, or a new CLI
  provider.
- Changing PTY ownership, Canvas terminal lifecycle, SQLite schema, or worktree
  isolation semantics.
- Importing Munder Difflin's Electron/Pixi/UI code.
- Deleting compatibility modules during the active Rust refactor.

## Proposed contract

Use an explicit, serializable delivery mode attached to the worker/agent spec:

```text
DeliveryMode =
  hook_inbox       // worker drains its inbox at lifecycle hooks
  terminal_handoff // renderer/main types a bounded work order into its PTY
  proxy_bridge     // provider sidecar observes the stream and receives work through its bridge
  manual           // no safe automated delivery; surface to orchestrator/human
```

The frontend catalog remains the authority for known CLI identities and their
declared transport. Rust validates the enum and treats missing/unknown values
as `manual` or a safe terminal fallback. No route is marked delivered until its
transport-specific acceptance is observed.

Route outcomes should be explicit and durable in the event payload:

```text
delivered       direct inbox write or confirmed transport acceptance
handoff_queued  terminal/proxy work order accepted for the target
bounced         returned to orchestrator with a stable reason
dropped         rejected by a hard invariant such as hop cap or invalid target
```

The existing `RouteReport` remains the command return type boundary where
possible; event payloads gain fields additively so old snapshots/events remain
readable.

## Implementation steps

### 1. Freeze the seam and baseline

- Reconcile this plan with the active Rust refactor plan.
- Capture current focused mailbox/router/orchestration test results.
- Confirm current `RouteReport`, `MailRouted` payload, manifest agent shape, and
  CLI catalog fields before changing them.
- Keep all current worktree changes outside this plan unstaged and untouched.

Proof: current focused tests, `git diff --check`, and a file ownership map with
no overlap ambiguity.

### 2. Add capability data at the existing provider seam

Likely files:

- `src/modules/terminal/lib/cliAgents.ts`
- `src/modules/architecture/lib/orchestrationManifest.ts`
- `src/modules/architecture/lib/orchestrationCanvasModel.ts`
- `src-tauri/src/modules/orchestration/model.rs`
- `src-tauri/src/modules/orchestration/protocol.rs`

Add the smallest capability field needed to construct a worker manifest. Keep
provider identity and launch command authority in the existing CLI catalog;
keep Rust generic over the delivery enum. Preserve backward compatibility for
manifests without the new field.

Proof: model/manifest round-trip tests, legacy manifest parsing, invalid mode
rejection, and launch prompt tests.

### 3. Make router delivery capability-aware

Likely files:

- `src-tauri/src/modules/orchestration/router.rs`
- `src-tauri/src/modules/orchestration/mailbox.rs`
- `src-tauri/src/modules/orchestration/command_support.rs`
- the final command adapter file selected by the active Rust refactor

Separate route planning from transport execution. For each recipient:

1. Resolve recipient identity and active/archived/on-hold state.
2. Select the transport from the worker capability.
3. Attempt the transport-specific delivery.
4. Return a structured outcome and reason.
5. Bounce or surface failures without claiming success.

Retain atomic file writes, cursor semantics, `.done`/archive behavior, hop
caps, idempotency, and self-delivery guards.

Proof: unit tests for every mode, missing recipient, archived worker, on-hold
worker, malformed message, hop cap, duplicate route, and transport failure.

### 4. Persist and project delivery outcomes

Likely files:

- `src-tauri/src/modules/orchestration/commands_impl.rs` or its post-refactor
  command module
- `src-tauri/src/modules/db/orchestration.rs`
- `src/modules/architecture/lib/orchestrationRuntime.ts`
- `src/modules/architecture/lib/useCanvasOrchestrationRun.ts`
- `src/modules/architecture/lib/orchestrationMailFlights.ts`

Record per-target outcomes in the existing event stream. Preserve the SQLite
run/event schema unless an actual query requirement proves a migration needed;
the preferred first version is additive JSON payload data. Update the Canvas
projection so failed/bounced mail does not fly as if it arrived, while the
operator can see the reason and retry through the existing command seam.

Proof: event replay tests, route-report projection tests, and mail-flight tests
covering delivered, handoff, bounced, and dropped outcomes.

### 5. Add wake/breaker regression matrix

Likely files:

- `src-tauri/src/modules/orchestration/wake.rs`
- `src-tauri/src/modules/orchestration/breaker.rs`
- `src-tauri/src/modules/orchestration/runtime.rs`

Do not redesign the policy. Add tests for:

- idle worker with unread mail receives one nudge;
- boot grace, cooldown, paused, halted, orchestrator, and no-PTY workers are
  skipped;
- recent HITL/permission notification suppresses a nudge and later rearms;
- repeated tool/input, error storm, token velocity, and compaction grace produce
  the existing breaker levels/actions;
- runtime forget clears wake/breaker state;
- route backlog after resume remains deliverable without duplicate nudges.

Proof: focused Rust tests plus existing orchestration suite; no production
policy change unless a failing regression demonstrates one.

### 6. Full verification and delivery handoff

- `pnpm exec tsc --noEmit`
- focused Vitest for orchestration manifest/runtime/mail-flight tests
- `pnpm test`
- `pnpm build`
- `cd src-tauri && cargo fmt --all -- --check`
- `cd src-tauri && cargo test --all-targets --locked`
- `cd src-tauri && cargo check --all-targets --locked`
- `cd src-tauri && cargo clippy --all-targets --locked -- -D warnings`
- `git diff --check`

Open an issue-backed branch/PR only after the current worktree ownership is
resolved. Include route outcome examples, test evidence, and known manual UI
verification gaps.

## Acceptance criteria

- A hook-capable worker receives direct mailbox delivery and gets a `delivered`
  outcome only after the atomic inbox write succeeds.
- A hookless/provider-proxy worker receives a supported terminal/proxy handoff,
  or the message is bounced with an actionable reason.
- Unknown capability/provider never silently disappears; it becomes a visible
  fallback outcome.
- `MailRouted` replay preserves per-target outcome data and old events still
  parse.
- Canvas only animates accepted deliveries and exposes failures for retry.
- Existing wake and breaker behavior remains unchanged except for added test
  coverage.
- Existing command names, serialized manifest fields, SQLite persistence shape,
  worktree isolation, and terminal ownership remain compatible.
- All focused and repository-required checks pass.

## Risks and recovery

- **Provider capability drift:** catalog and runtime disagree. Mitigation:
  explicit enum, legacy fallback, and launch/protocol tests.
- **False delivery success:** route report says sent before transport accepts.
  Mitigation: outcome-producing transport adapters and event tests.
- **Unbounded fallback queues:** terminal handoffs pile up for an offline worker.
  Mitigation: bounded per-target pending state, visible backlog, and retry/drop
  policy recorded in the route report.
- **Refactor collision:** active Rust split moves command ownership while this
  work edits the same files. Recovery: finish/rebase the Rust refactor first;
  do not resolve by broad overwrite or reset.
- **Schema/event compatibility:** old runs lack delivery fields. Mitigation:
  additive optional payload fields and replay tests with legacy fixtures.

## Progress

- [x] Read Munder Difflin's hive design and implementation patterns.
- [x] Reconcile priorities: capability-aware delivery first; wake/breaker as
  regression coverage only.
- [ ] Freeze current cmdSpace routing/report contract after active Rust refactor.
- [ ] Implement capability contract and safe fallback routing.
- [ ] Persist/project per-target outcomes.
- [ ] Add wake/breaker test matrix.
- [ ] Run full verification and deliver issue-backed PR.

## Decisions

- 2026-09-07: Treat capability-aware delivery as the primary feature. Munder's
  strongest transferable idea is not a new orchestrator; it is refusing to
  route mail through a transport the recipient cannot consume.
- 2026-09-07: Preserve cmdSpace's existing wake/breaker runtime and add tests;
  do not replace working policy with Munder's implementation.
- 2026-09-07: Keep delivery capability as a small serialized contract derived
  from the existing CLI catalog, with Rust validation and safe fallback.
- 2026-09-07: Prefer additive event payload fields over a SQLite migration for
  the first delivery-outcome version.

## Validation

Focused proof to collect during implementation:

- mailbox/router unit tests for every delivery mode and failure path;
- manifest/protocol serialization and legacy fixture tests;
- event replay and Canvas mail projection tests;
- wake/breaker matrix tests.

Repository proof:

- frontend typecheck, focused Vitest, full Vitest/build;
- Rust fmt, orchestration/all-target tests, check, and Clippy;
- `git diff --check` and a final dirty-worktree ownership review.

## Result

Not implemented yet. This plan is the single execution artifact for the next
orchestration delivery work. Do not move it to `docs/plans/completed/` until the
acceptance criteria and verification commands have fresh evidence.
