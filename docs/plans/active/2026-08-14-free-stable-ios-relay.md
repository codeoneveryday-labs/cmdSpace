# Free Stable iOS Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ephemeral public-tunnel dependency for native iOS remote access with a fixed, free Cloudflare Durable Object relay.

**Architecture:** A Worker routes each stable desktop relay ID to one Durable Object. The desktop and iOS clients each open outbound WSS connections to that object. The relay owns socket presence and byte forwarding only; desktop remains the v3 pairing, authorization, workspace, and PTY authority.

**Tech Stack:** Cloudflare Workers/ Durable Objects/ Wrangler, Rust/Tauri, existing remote v3 protocol, Swift URLSession WebSocket, Swift Package tests, Vitest Worker tests.

---

## Status

Implemented; manual device/simulator cross-network acceptance remains pending.

## Context and authority

- Design: `docs/superpowers/specs/2026-08-14-free-stable-ios-relay-design.md`.
- Native device trust boundary: `docs/decisions/0010-remote-device-capabilities.md`.
- Existing iOS contract: `docs/architecture/ios-desktop-remote-integration.md`.
- Transport state must not become an authority for workspace/terminal policy.
- Cloudflare deployment credentials are local Wrangler credentials and must not
  be written into any tracked file.

## File structure

| Path | Responsibility |
| --- | --- |
| `services/cmdspace-relay/src/index.ts` | Stateless HTTP upgrade validation and deterministic routing by relay ID. |
| `services/cmdspace-relay/src/desktop-relay.ts` | One Durable Object per desktop; role admission, socket presence, forwarding, and offline replies. |
| `services/cmdspace-relay/wrangler.jsonc` | Worker name, compatibility date, Durable Object binding/migration, and observability configuration. |
| `services/cmdspace-relay/test/desktop-relay.test.ts` | Worker/DO contract tests for role ownership, forwarding, and offline recovery. |
| `src-tauri/src/modules/remote_relay.rs` | Desktop relay identity, outbound client lifecycle, backoff, and local socket bridge. |
| `src-tauri/src/modules/remote.rs` | Chooses relay transport for native v3 pairing while retaining existing LAN/browser paths. |
| `src-tauri/src/modules/remote_devices.rs` | Persists a relay ID/admission material with device-pairing state without changing device capabilities. |
| `crates/cmdspace-remote-protocol/src/lib.rs` | Typed relay admission envelopes and stable pairing payload fields. |
| `mobile/ios/CmdSpaceMobileCore/.../PairingPayload.swift` | Parses fixed relay QR payload without appending the direct desktop WebSocket path. |
| `mobile/ios/CmdSpaceMobileApp/RemoteStore.swift` | Connects iOS to relay, distinguishes offline from unauthenticated, and preserves saved desktop identity. |
| `mobile/ios/CmdSpaceMobileCore/Tests/CmdSpaceMobileCoreTests.swift` | QR and transport-state regression coverage. |

## Risks and recovery

- **Cloudflare unavailable or quota-limited:** surface retryable offline state;
  do not revoke or replace a saved pairing.
- **Desktop reconnects:** relay replaces only the previous desktop socket for
  the same authenticated relay identity and keeps device sockets connected.
- **Stale/guessed relay ID:** require a signed or random admission credential;
  never grant the desktop role merely from the ID.
- **Regression to browser/LAN access:** leave v2 and the direct/LAN listener
  untouched and cover the v3 relay selection with focused tests.
- **Recovery:** disabling relay transport falls back to the existing local
  listener/tunnel configuration; it does not delete paired device records or
  mobile workspaces.

## Progress

### Task 1: Define the relay wire contract

**Files:**
- Modify: `crates/cmdspace-remote-protocol/src/lib.rs`
- Modify: `crates/cmdspace-remote-protocol/tests/wire_contract.rs`
- Modify: `mobile/ios/CmdSpaceMobileCore/Sources/CmdSpaceMobileCore/PairingPayload.swift`
- Modify: `mobile/ios/CmdSpaceMobileCore/Tests/CmdSpaceMobileCoreTests.swift`

- [x] Add typed relay-client admission messages with the exact roles `desktop`
  and `device`, stable `relayId`, and opaque admission credential; do not put
  terminal payloads into this layer.
- [x] Extend the pairing QR schema with relay base URL and relay ID while
  retaining grant parsing and rejecting non-HTTPS relay origins.
- [x] Write wire-contract and Swift parsing tests first for valid relay QR,
  missing relay ID, insecure relay URL, and backward-compatible direct QR.
- [x] Implement the minimal serializers/parsers and run:
  `cargo test --manifest-path crates/cmdspace-remote-protocol/Cargo.toml --locked`
  and `swift test --package-path mobile/ios/CmdSpaceMobileCore`.

### Task 2: Build the isolated Cloudflare relay service

**Files:**
- Create: `services/cmdspace-relay/package.json`
- Create: `services/cmdspace-relay/tsconfig.json`
- Create: `services/cmdspace-relay/wrangler.jsonc`
- Create: `services/cmdspace-relay/src/index.ts`
- Create: `services/cmdspace-relay/src/desktop-relay.ts`
- Create: `services/cmdspace-relay/test/desktop-relay.test.ts`

- [x] Add a standalone Worker package rather than adding Cloudflare runtime
  dependencies to the desktop React package.
- [ ] Configure one `DESKTOP_RELAY` Durable Object binding with a SQLite
  migration and a current compatibility date. Generate Worker binding types
  from Wrangler configuration instead of hand-writing an `Env` interface.
- [ ] Write failing tests for: reject non-WebSocket requests; reject malformed
  admission; accept one authenticated desktop; forward device text/binary
  frames to desktop; return `desktop_offline` when absent; replace a desktop
  reconnect; and close/reject stale sockets cleanly.
- [x] Implement deterministic `getByName(relayId)` routing and hibernatable
  WebSockets. Store only role/presence metadata necessary to restore socket
  tags; never write terminal output or grants to DO storage.
- [x] Run `pnpm --dir services/cmdspace-relay test`, `pnpm --dir
  services/cmdspace-relay exec wrangler types`, and `pnpm --dir
  services/cmdspace-relay exec wrangler deploy --dry-run`.

### Task 3: Add desktop relay lifecycle and local bridge

**Files:**
- Create: `src-tauri/src/modules/remote_relay.rs`
- Modify: `src-tauri/src/modules/mod.rs`
- Modify: `src-tauri/src/modules/remote.rs`
- Modify: `src-tauri/src/modules/remote_devices.rs`
- Create: `src-tauri/src/modules/remote_relay_test.rs`

- [ ] Write Rust unit tests for stable relay identity generation, backoff bounds,
  desktop-online/offline transitions, and conversion of relay frames to the
  existing native-device WebSocket handler input/output.
- [x] Implement an outbound WSS lifecycle that reconnects without changing
  exponential backoff and does not create a new relay ID after reconnect.
- [x] Bridge each relay device stream into the existing v3
  handshake/command pipeline. Keep `PairDevice`, `AuthenticateDevice`,
  `DeviceRegistry`, and terminal authorization in `remote.rs`; the relay module
  must not interpret remote command payloads.
- [ ] Use a distinct relay status in snapshots/events so UI can distinguish
  connected, connecting, and unavailable without treating offline as a
  credentials failure.
- [ ] Run focused relay tests, then:
  `cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked`.

### Task 4: Make iOS select and recover relay transport

**Files:**
- Modify: `mobile/ios/CmdSpaceMobileApp/RemoteStore.swift`
- Modify: `mobile/ios/CmdSpaceMobileApp/RootView.swift`
- Modify: `mobile/ios/CmdSpaceMobileCore/Tests/CmdSpaceMobileCoreTests.swift`

- [ ] Write tests for saved relay endpoint reuse, background socket closure,
  device-authentication reconnect, and UI state mapping of `desktop_offline`
  to a recoverable unavailable card.
- [x] Implement a single `URLSessionWebSocketTask` path that connects to the
  relay URL from pairing data. It must preserve device Keychain identity and
  never persist WebSocket session state.
- [ ] Update Home/UI state only through `RemoteStore`; a connected relay opens
  workspace access, offline state locks terminal actions with a retry action,
  and direct pairing/authentication errors retain their existing treatment.
- [ ] Run `swift test --package-path mobile/ios/CmdSpaceMobileCore` and build
  the configured iOS simulator scheme.

### Task 5: Deploy and prove cross-network recovery

**Files:**
- Modify: `docs/product/remote-access.md`
- Modify: `docs/architecture/ios-desktop-remote-integration.md`
- Modify: this plan with observed deployment URL and validation outcome

- [x] Authenticate verification: run `npx wrangler whoami` and confirm it
  reports the user-owned account without printing tokens.
- [x] Deploy only after Worker unit tests and dry-run pass, using:
  `pnpm --dir services/cmdspace-relay exec wrangler deploy`.
- [ ] Record only the public Worker hostname in desktop configuration; no
  secret material belongs in docs, source, or the QR screenshot.
- [ ] Pair a fresh simulator/device, place phone and Mac on distinct networks,
  create/attach a mobile terminal, suspend/reconnect the Mac, and verify that
  the same pairing recovers without scanning a new QR.
- [ ] Update product and integration documentation with relay limitations,
  failure UI, free-tier constraint, and browser v2 non-scope.

## Validation

- Focused proof: protocol, Worker/DO, Rust relay, and Swift core tests.
- Integration proof: local Worker relay plus desktop/iOS Simulator handshake,
  attach, input, and output.
- End-to-end proof: deployed free Worker between separate networks plus Mac
  offline/reconnect recovery.
- Repository-required checks: relevant `pnpm` build, `cargo check
  --all-targets --locked`, and Swift simulator build.

## Decisions

- 2026-08-14: Use a user-owned Cloudflare Free Worker + Durable Object rather
  than an ephemeral reverse tunnel because relay identity must be stable across
  network reconnections.
- 2026-08-14: Keep device authorization at desktop; the relay is a transport
  component and has no terminal/workspace persistence.

## Result

- Deployed Worker hostname: `https://cmdspace-relay.shayugoodkid.workers.dev`.
- Validated Worker locally (four unit tests) and live: desktop admission,
  device admission, device-to-desktop v3 frame forwarding, and reverse frame
  forwarding all passed against the deployed Worker.
- Rust protocol tests, focused native v3 pairing test, `cargo check`, frontend
  build, and Swift core tests passed.
- Remaining manual acceptance: pair a physical device/simulator over a
  different network with the newly built desktop app, then verify recovery
  after the desktop reconnects. The relay intentionally drops active sockets
  during an outage; the saved pairing reconnects without a new QR.
