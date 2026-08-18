# Zedra-informed Mobile Remote Implementation Plan

> **For agentic workers:** Implement one checked task at a time. Keep the mobile
> protocol/lifecycle crates independent of `src-tauri`; platform adapters own one
> WebSocket and secure credential storage.

Date: 2026-08-12

## Status

Active

## Outcome

Terax Remote can pair a named mobile device through a short-lived, one-time QR
grant; grant it explicit workspace/session capabilities; revoke that device
without rotating every client; and recover a selected terminal cleanly after a
network interruption or host runtime restart.

## Context

- Current host remote access: `src-tauri/src/modules/remote.rs`,
  `remote_auth.rs`, and `remote_tunnel.rs`.
- Shared wire contract: `crates/terax-remote-protocol/`.
- Native lifecycle core: `crates/terax-remote-client/`.
- Native app state: `mobile/terax-mobile/`.
- Mobile boundary and first-iOS host runbook: `mobile/README.md` and
  `docs/mobile/ios-first-build.md`.
- Reference model: `../zedra/docs/NETWORK_TRANSPORT.md` and
  `../zedra/docs/WEB_TUNNEL_MODES.md`.

## Scope

In scope:

- Per-device identity, one-time pairing grants, device enumeration, and
  device-specific revocation.
- Capability checks that constrain a device to approved workspace and terminal
  sessions, with explicit create/close/input permissions.
- Client-visible reconnect state, bounded retry policy, heartbeat, and
  snapshot/delta terminal recovery.
- Bounded mobile terminal scrollback and protocol/lifecycle tests.

Out of scope:

- Iroh, QUIC, pkarr discovery, NAT traversal, or a Terax-operated relay.
- Zedra-style localhost web-preview proxying; revisit only when mobile preview
  is a defined product surface.
- iOS/Android UI framework selection, terminal renderer choice, app signing,
  and production distribution.

## Architecture

Keep the current separation of concerns:

```text
Desktop remote host
  -> versioned remote protocol
  -> platform-neutral RemoteClient lifecycle
  -> TeraxMobileApp render state
  -> future SwiftUI / Android platform adapter
```

Add a host-owned device registry. A pairing QR carries a random, expiring,
one-time grant plus a host key fingerprint and permitted capability scope. The
mobile client generates and secure-stores its device signing key; it proves
possession during pairing and reconnect. The host stores only the public key,
device metadata, capability grant, and revocation state.

Do not change transport as part of this plan. LAN WebSocket and public tunnel
remain carriers beneath the same authenticated protocol. A later transport
project may add application-layer E2EE or a relay without changing device
authorization semantics.

## Risks And Recovery

- A pairing capability broader than its QR intent becomes privilege escalation.
  Validate every remote command at the host; never trust mobile UI filtering.
- A lost device key must be revocable without deleting unrelated devices.
  Revoke its registry entry, active token, and live socket only.
- Terminal replay may duplicate or omit bytes after reconnect. Preserve the
  existing `(runtime_id, session_id, sequence)` rule and test host restart,
  ring-buffer miss, and duplicate deltas.
- Device keys and tokens are credentials. Keep private keys/tokens out of logs,
  URLs after bootstrap, crash reports, source control, and Rust core storage.
- Each task is additive. Recovery is to disable the new pairing path and retain
  the existing password-auth remote flow until migration is proven.

## Progress

### Task 1: Define device authorization policy

- [ ] Create `docs/decisions/0010-remote-device-capabilities.md`.
- [ ] Specify `DeviceCapability` fields: workspace identifier, allowed terminal
  IDs or wildcard policy, `view`, `input`, `create_terminal`, `close_terminal`,
  expiry, and revocation semantics.
- [ ] Specify the migration from existing password bootstrap to QR pairing:
  existing browser sessions continue to work; new native-device pairing uses
  the device registry.
- [ ] Record the production transport policy: `wss` required for non-loopback
  endpoints; loopback/LAN `ws` is explicitly development-only until a separate
  product decision authorizes it.
- [ ] Review this decision before code changes that add a capability field.

### Task 2: Extend the shared protocol for pairing and recovery

**Files:**

- Modify: `crates/terax-remote-protocol/src/lib.rs`
- Modify: `crates/terax-remote-protocol/tests/wire_contract.rs`
- Modify: `src/remote/protocol.ts`
- Modify: `src/remote/protocol.test.ts`

- [ ] Write Rust and TypeScript contract tests for the same versioned envelopes:
  pairing offer, device registration proof, device-authenticated connect,
  capability-denied error, heartbeat, and terminal snapshot-needed response.
- [ ] Add only the message/data types needed by those tests. Preserve protocol
  v2 decoding for existing browser clients; introduce v3 only if a v2 envelope
  cannot represent the feature without ambiguous optional fields.
- [ ] Make unsupported versions fail closed on both host and client.
- [ ] Run `cargo test --manifest-path crates/terax-remote-protocol/Cargo.toml`
  and `pnpm vitest run src/remote/protocol.test.ts`.

### Task 3: Build host device registry and one-time pairing grants

**Files:**

- Create: `src-tauri/src/modules/remote_devices.rs`
- Modify: `src-tauri/src/modules/mod.rs`
- Modify: `src-tauri/src/modules/remote.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/modules/remote_auth.rs`
- Test: `src-tauri/src/modules/remote_devices_test.rs`

- [ ] Write tests for a grant expiring, being consumed exactly once, rejecting a
  malformed proof, creating a named device, and revoking only that device.
- [ ] Store device public keys, display names, capability grants, timestamps,
  and revoked status in an app-private durable registry with restrictive file
  permissions.
- [ ] Replace raw bootstrap-secret pairing for native mobile with a random,
  short-lived one-time grant. Bind it to the requested capability scope before
  it is shown as QR data.
- [ ] Authenticate reconnects by challenge/response with the stored device
  public key. Rotate short-lived session tokens after every successful attach.
- [ ] Ensure device revocation invalidates its tokens and closes only its active
  WebSocket connections.
- [ ] Run `cd src-tauri && cargo test remote_devices` and
  `cd src-tauri && cargo check --all-targets --locked`.

### Task 4: Enforce capability at every host command boundary

**Files:**

- Modify: `src-tauri/src/modules/remote.rs`
- Test: `src-tauri/src/modules/remote.rs` unit-test module or focused
  `remote_capability_test.rs`

- [ ] Write authorization tests for listing sessions, attaching, input,
  resizing, closing, and creating terminals from a device with a deliberately
  restricted capability.
- [ ] Add a single authorization function taking authenticated device identity,
  requested operation, workspace/cwd, and optional session ID.
- [ ] Call it before any PTY mutation and before returning session metadata or
  terminal output; return a non-retryable `capability_denied` protocol error.
- [ ] Define session ownership policy: one active controlling device per
  terminal for P0. A second controller receives `session_occupied`; explicit
  takeover is a later user-facing action.
- [ ] Run focused Rust tests plus `cd src-tauri && cargo clippy --all-targets
  --locked -- -D warnings` when practical.

### Task 5: Make reconnect and terminal recovery explicit in the native core

**Files:**

- Modify: `crates/terax-remote-client/src/lib.rs`
- Modify: `crates/terax-remote-client/tests/client_lifecycle.rs`
- Modify: `mobile/terax-mobile/src/lib.rs`
- Modify: `mobile/terax-mobile/tests/app_state.rs`

- [ ] Write failing lifecycle tests for foreground heartbeat timeout, retries at
  1/2/4 seconds, retry exhaustion, runtime restart, ring-buffer miss, and an
  attach resuming from the last known sequence.
- [ ] Add explicit client actions for `ScheduleReconnect`, `Send(Ping)`, and
  `ResetTerminal` without adding networking or timers to the Rust core.
- [ ] Keep platform adapters responsible for opening exactly one socket and
  scheduling actions; keep the controller deterministic and testable.
- [ ] Change `TeraxMobileApp` to retain bounded terminal output, with an
  explicit byte/line budget. On `ResetTerminal`, discard only the affected
  session output before applying its new snapshot.
- [ ] Run `cargo test --manifest-path crates/terax-remote-client/Cargo.toml`
  and `cargo test --manifest-path mobile/Cargo.toml -p terax-mobile`.

### Task 6: Surface safe device management in desktop settings

**Files:**

- Modify: `src/modules/settings/remoteAccess.ts`
- Modify: `src/settings/sections/GeneralSection.tsx` or new
  `src/settings/sections/RemoteDevicesSection.tsx`
- Test: focused Vitest/source test alongside the owning settings component

- [ ] Write tests that verify device names, scope summary, last-seen value, and
  revoke affordance are rendered without exposing public keys, tokens, or QR
  grant secrets.
- [ ] Add host invokes to list devices, start scoped pairing, and revoke a
  selected device.
- [ ] Make revoke confirmation name the exact device and its scope; after
  confirmation, refresh the list and show the terminated state.
- [ ] Keep raw pairing grant material visible only in the QR setup flow and
  remove it from UI state as soon as the grant is consumed or expires.
- [ ] Run focused Vitest and `pnpm build`.

### Task 7: Prove end-to-end behavior before adding native UI

- [ ] Add a manual remote test section covering: QR pairing, one-time QR reuse
  failure, capability denial, device-specific revocation, terminal ownership,
  airplane-mode reconnect, host restart, and terminal history recovery.
- [ ] Run all focused Rust/TypeScript tests from Tasks 2–6.
- [ ] Run `pnpm build`.
- [ ] Run `cd src-tauri && cargo check --all-targets --locked` and, when the
  machine supports it, `cargo clippy --all-targets --locked -- -D warnings`.
- [ ] Record exact commands and observed results in this plan's Result section.

## Decisions

- 2026-08-12: Start with Zedra's device identity, scoped ACL, lifecycle, and
  reconciliation ideas; defer its Iroh/QUIC/pkarr transport implementation.
- 2026-08-12: Keep mobile transport and secure storage out of the pure Rust
  protocol/lifecycle crates.
- 2026-08-12: Treat mobile terminal remote control as exclusive in P0 to avoid
  input interleaving; add collaboration only with an explicit takeover model.

## Validation

- Focused proof: protocol, registry, remote authorization, lifecycle, and
  mobile state tests named in each task.
- Integration proof: host starts; a paired device can attach only to permitted
  sessions; revocation terminates that device; reconnect recovers terminal
  state without duplicated output.
- Repository checks: `pnpm build`; `cd src-tauri && cargo check --all-targets
  --locked`; Clippy with warnings denied when practical.

## Result

Not started. Update after each validated task and move this file to
`docs/plans/completed/` only after the end-to-end proof is recorded.
