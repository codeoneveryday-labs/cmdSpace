# Resident Agent Runtime Daemon

Date: 2026-08-29

## Outcome

Make Agent Chat feel resident instead of tab-bound: the Rust backend owns the
agent process and session lifecycle, while React attaches to an existing runtime
and only renders/subscribes to its timeline. Opening an already-known chat must
not spawn a second provider process.

This phase deliberately implements an in-process resident daemon inside the
Tauri backend. A separately launched OS daemon/sidecar is a follow-up decision,
made only after startup and resource measurements prove it is needed.

## Constraints

- Preserve the existing `agent_chat_*` IPC commands until the new attach path
  has equivalent coverage.
- Keep `useTabs` and workspace ownership unchanged.
- Never duplicate a provider process for the same durable chat identity.
- Idle runtimes must not poll or consume GPU; provider CPU/RAM policy must be
  explicit and observable.
- No new dependency.
- Do not modify `src-tauri/src/lib.rs` beyond command wiring; its current
  composition-root split is already complete.
- Preserve pre-existing user changes in `.commandcode/settings.json`.

## Current evidence

- `useAgentChatSession` starts a provider on first active mount via
  `agent_chat_start`; see `src/modules/ai/hooks/useAgentChatSession.ts`.
- `AgentChatRuntime` stores sessions by ephemeral runtime id in
  `src-tauri/src/modules/agent_chat/mod.rs`.
- `agent_chat_close` currently removes and kills the provider process.
- Model/control discovery is also eager on first active chat in
  `src/modules/ai/components/AgentChatWorkspace.tsx`.

## Architecture

```text
React chat tab
    │ attach(chatId, channel)
    ▼
Rust AgentDaemon
    ├── durable chat id → AgentRuntime record
    ├── provider process (0 or 1)
    ├── bounded event replay buffer
    ├── subscribers/channels
    └── idle suspension policy
```

The durable `chatId` becomes the stable public identity. The provider-native
session id remains provider data; the OS process id and Tauri channel remain
ephemeral.

## Implementation steps

### 1. Baseline and contract

- Add a deterministic startup timing helper around attach/start/first event.
- Record cold-start and warm-attach timings for Codex and one print provider.
- Define `AgentRuntimeState` (`starting`, `idle`, `running`, `error`,
  `suspended`) and the attach result/event contract.

### 2. Resident Rust daemon

- Add `AgentDaemon` around the existing `AgentChatRuntime` session map, keyed by
  durable `chatId`.
- Keep one provider backend per chat; attach replaces only the subscriber, never
  the backend.
- Add a bounded replay tail so a newly attached UI receives the latest events.
- Separate `detach` from `close`: tab unmount/detach removes a channel;
  explicit close/archive stops the provider.
- Keep provider-specific launch/resume logic in existing adapter modules.

### 3. Tauri command migration

- Add `agent_chat_attach` and `agent_chat_detach` commands.
- Make `agent_chat_start` idempotent for a supplied durable `chatId`.
- Preserve existing `agent_chat_send/cancel/close/load_history` behavior through
  the daemon coordinator.
- Register commands in `src-tauri/src/commands.rs`; keep `lib.rs` as wiring only.

### 4. Frontend migration

- Update `agentChatRuntime.ts` with `attach/detach` ports.
- Change `useAgentChatSession` to attach by `chatId`, subscribe to replay/live
  events, and detach on unmount without closing the provider.
- Keep explicit cancel/close semantics separate from tab visibility.
- Do not run model/control discovery on the critical first paint; use cached
  values first and refresh in the background.

### 5. Resource policy

- Keep idle provider processes resident for a bounded grace period.
- On memory pressure or expiry, suspend/close the process while retaining
  durable session metadata and replay tail.
- Ensure no idle timer, polling loop, or hidden WebView work runs per agent.
- Add metrics for resident count, process lifetime, attach latency, and replay
  size.

### 6. Verification

- Rust unit tests: idempotent start, one backend per chat, attach replay,
  detach-without-kill, explicit close, stale subscriber cleanup, and bounded
  replay.
- Frontend tests: tab unmount/remount keeps runtime, attach receives latest
  timeline, duplicate attach does not duplicate process, cached model paint.
- Run sequentially:

  ```bash
  pnpm exec tsc --noEmit
  pnpm test
  pnpm build
  cd src-tauri && cargo check --all-targets --locked
  cd src-tauri && cargo clippy --all-targets --locked -- -D warnings
  ```

## Acceptance criteria

- Reopening an existing agent chat does not invoke provider spawn twice.
- Detaching/remounting the chat UI preserves the same runtime identity.
- The first visible timeline event on warm attach is delivered from replay or a
  live subscription without waiting for a new provider bootstrap.
- Explicit close still terminates the provider and removes its runtime record.
- Resident count, attach latency, and replay size are observable in debug logs or
  test instrumentation.
- Existing provider protocol tests and all current quality gates remain green.

## Risks

- Provider process leaks: centralize ownership and test explicit close plus
  backend exit cleanup.
- Duplicate subscribers: key subscriptions by channel identity and remove them
  on detach/failed send.
- Stale event delivery: attach includes a monotonically increasing runtime
  generation and bounded replay sequence.
- Resource growth: cap resident runtimes and replay bytes; keep an explicit
  suspension policy instead of indefinite hidden work.
- Scope creep into a full OS daemon: defer sidecar packaging until metrics show
  in-process residency is insufficient.

## Progress

- [x] Confirm release HEAD and preserve `.commandcode/settings.json`.
- [x] Record current cold-start architecture and write this execution plan.
- [x] Implement resident daemon coordinator keyed by durable `chatId`.
- [x] Add idempotent start plus attach/detach Tauri commands.
- [x] Migrate frontend session hook to attach first and detach without killing.
- [x] Add bounded 15-minute detached-runtime policy and warm/cold latency logs.
- [x] Add a bounded 128-event replay tail delivered before live events on attach.
- [x] Extract the replay/channel behavior into `agent_chat/event_sink.rs` with
      an isolated bounded-tail test.
- [x] Extract Claude and print provider turn spawning into
      `agent_chat/sessions.rs` without changing provider launch contracts.
- [x] Extract provider-specific process construction into
      `agent_chat/launch.rs` without changing provider launch contracts.
- [x] Extract public Agent Chat Tauri handlers into `agent_chat/commands.rs`
      without changing wire command names.
- [x] Expose resident/attached/detached/replay counters through
      `agent_chat_runtime_status` for runtime measurement.
- [x] Defer CLI model discovery until the picker/refresh path so the first chat
      paint does not launch discovery work.
- [x] Remove eager model discovery from the first active chat mount; discovery
      now starts from the picker/refresh path while cached models remain usable.
- [x] Run TypeScript, frontend tests/build, Rust check/clippy and targeted daemon tests.

### MVP result

- Resident agent runtimes are keyed by durable chat id and survive UI
  detach/remount while the Tauri process remains alive.
- Reaper policy runs every 60 seconds and closes detached runtimes after the
  15-minute grace period; replay is capped at 128 events.
- Warm/cold lifecycle timings are emitted through `log::debug!` for local
  measurement.
- A separately launched OS daemon remains intentionally deferred until a real
  cold-start benchmark justifies sidecar packaging and cross-process protocol
  work.

## Approved startup-readiness follow-up — 2026-08-31

**Outcome:** Opening an Agent Chat shows an immediately usable composer. A new
provider runtime starts only when the user submits the first prompt; existing
resident chats still attach in the background.

**Approach:** Keep the React UI and the native provider lifecycle separate.
The first prompt uses one attach-or-start operation, rather than being rejected
while an empty background start is in flight. Cached model/config values remain
available at mount, while CLI control discovery is picker-triggered only.

**Files:**

- `src/modules/ai/hooks/useAgentChatSession.ts` — remove empty auto-start and
  serialize first-prompt admission.
- `src/modules/ai/hooks/useAgentChatControls.ts` — keep control discovery off
  the active-chat mount path.
- `src/modules/ai/lib/agentChatStartup.ts` — pure admission model for direct
  behavioral tests.
- `src/modules/ai/lib/agentChatStartup.test.ts` — prove first prompt starts
  once and warm attach reuses the resident session.

**Verification:** Measure open-to-composer readiness separately from
send-to-first-provider-event; run focused Vitest, TypeScript checking, the
frontend suite, production build, and Rust checks because the native contract
is unchanged but remains the execution boundary.

**Progress:**

- [x] Added a direct startup-admission model with cold-start, warm-attach,
  single-flight, and retry tests.
- [x] Reworked the session hook so the active-chat effect attempts only a warm
  attach; it does not start a provider with an empty prompt.
- [x] Routed the first prompt through the startup admission model and sends it
  only after a warm attach; cold start receives that prompt directly.
- [x] Confirmed controls remain picker-triggered rather than active-mount
  discovery.
- [x] Ran focused Agent Chat tests.
- [x] Full repository validation: `pnpm test`, `pnpm build`, Cargo check, and
  Clippy with warnings denied all pass.
