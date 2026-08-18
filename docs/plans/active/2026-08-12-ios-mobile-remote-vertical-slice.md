# iOS Mobile Remote Vertical Slice Implementation Plan

> **For agentic workers:** Implement one checked task at a time. Preserve the
> boundary that the iOS adapter owns one WebSocket and Keychain access, while
> Terax Rust owns protocol and lifecycle semantics. Do not add a third-party UI,
> terminal, cryptography, or transport dependency in this plan.

Date: 2026-08-12

## Status

Active

## Outcome

An installable iOS app can pair a named device with a Terax desktop using a
one-time scoped QR grant, retain device credentials in Keychain, reconnect to
one permitted remote terminal, display bounded terminal output, and send
keyboard input without duplicating remote protocol or authorization logic.

The release target is an external TestFlight build: a tester installs Terax on
an iPhone/iPad, scans a pairing QR from the desktop app, and remotely controls
the same desktop-host Remote Access service that the browser remote UI uses.
The iOS client is a new authenticated client of that host; it is not a mobile
webview wrapper and does not require a separate mobile backend.

## Context

- Mobile core branch/worktree: `feat/231-native-mobile-foundation`.
- Existing Rust protocol/client/mobile-state boundary:
  `crates/terax-remote-protocol/`, `crates/terax-remote-client/`, and
  `mobile/terax-mobile/`.
- Initial artifact guidance: `docs/mobile/ios-first-build.md`.
- Zedra-informed remote foundation: 
  `docs/plans/active/2026-08-12-zedra-informed-mobile-remote.md`.
- Zedra reference for device pairing, session ACLs, challenge response, and
  reconnect: `../zedra/docs/NETWORK_TRANSPORT.md`.

## Scope

In scope:

- A Terax-authored SwiftUI iOS project and Simulator/device build path.
- Narrow C ABI from Swift to the existing Rust mobile app state.
- `URLSessionWebSocketTask` transport, Keychain credential storage, and camera
  QR scanning with manual pairing fallback.
- Zedra-informed device identity, one-time pairing, capability enforcement,
  per-device revoke, exclusive terminal ownership, and reconnect recovery.
- One selected terminal at a time, bounded output, input, resize, session list,
  and connection diagnostics.

Out of scope:

- Android, TestFlight submission, or a public App Store release.
- Iroh/QUIC/pkarr/P2P or an operated E2EE relay.
- Mobile file explorer, git mutation, AI approval, and localhost web preview.
- A third-party terminal-emulator dependency. P0 shows output and sends input;
  ANSI emulation, selection, search, and full scrollback are a follow-up after
  an explicit dependency/license decision.

## Architecture

```text
Desktop: device registry + capabilities + PTY authority
     ↕ remote protocol envelopes over WSS
iOS: URLSessionWebSocketTask + Keychain + QR scanner
     ↕ JSON C ABI
Rust: TeraxMobileApp -> RemoteClient -> remote-protocol
     ↕ published SwiftUI ObservableObject state
SwiftUI: Pair / Connecting / Remote terminal screens
```

The desktop is the authority: the iOS app cannot select a workspace, attach a
session, or mutate a terminal unless its granted `DeviceCapability` permits the
operation. The iOS app owns the private device key and short-lived session
credential in Keychain. The Rust library never writes those credentials and
does not create sockets/timers. Swift executes Rust-returned effects and
renders Rust-derived state.

## File Map

| Path | Responsibility |
| --- | --- |
| `docs/decisions/0010-remote-device-capabilities.md` | Durable security and capability authority. |
| `crates/terax-remote-protocol/` | Pairing/auth/recovery wire envelopes shared by host and iOS core. |
| `crates/terax-remote-client/` | Deterministic connection/reconnect/session lifecycle effects. |
| `mobile/terax-mobile/include/terax_mobile.h` | C ABI surface consumed by Swift only. |
| `mobile/terax-mobile/src/ffi.rs` | JSON-in/JSON-out bridge and allocation/free implementation. |
| `mobile/ios/TeraxMobile.xcodeproj` | Native iOS application target. |
| `mobile/ios/TeraxMobile/AppModel.swift` | Owns one WebSocket, runs Rust effects, publishes SwiftUI state. |
| `mobile/ios/TeraxMobile/KeychainStore.swift` | Keychain-only secret persistence. |
| `mobile/ios/TeraxMobile/PairingScanner.swift` | QR input and manual-entry validation. |
| `mobile/ios/TeraxMobile/RemoteTerminalView.swift` | Bounded output display, keyboard input, session chooser. |
| `src-tauri/src/modules/remote_devices.rs` | Host device registry, grants, and per-device revocation. |
| `src-tauri/src/modules/remote.rs` | Capability checks, terminal ownership, snapshot/delta host adapter. |

## Sequencing

The security/protocol work must land before a production iOS client because
Keychain persistence would otherwise make the old shared-password token model
a compatibility contract. The Swift host may be scaffolded in parallel, but it
must use a mock Rust ABI until the pairing/recovery envelopes are complete.

## Delivery Phases And Exit Gates

### Phase 0: Freeze the remote contract and TestFlight acceptance criteria

**Purpose:** Remove ambiguity before persisted iOS credentials or a public beta
exist. The website remote flow remains a compatibility client throughout.

**Deliverables:**

- Decision records 0010/0011 from Task 1.
- Written TestFlight acceptance script in `docs/MANUAL_TEST.md`.
- A compatibility table: browser uses remote protocol v2/password token;
  native iOS uses v3/device identity; both share the same `remote_access_start`
  host, public tunnel, LAN fallback, sessions, and PTY authority.

**Exit gate:** a reviewer can answer these questions from the docs alone:

1. What exact data is encoded in the iOS QR, and which fields are one-time?
2. Which desktop workspace/session/device operations are granted?
3. How does a user revoke a lost phone without invalidating website sessions?
4. Which URL does iOS connect to, and why is it the same host endpoint as the
   browser remote UI?
5. What happens when iOS backgrounds, the public tunnel reconnects, or the
   desktop host restarts?

No iOS credential persistence or TestFlight-facing screen work starts before
this gate passes.

### Phase 1: Secure desktop host upgrade, still browser-compatible

**Purpose:** Teach the desktop remote service Zedra's highest-value lessons:
named device identity, one-time grants, scoped ACL, precise revocation,
exclusive control, and explicit recovery.

**Deliverables:**

- Tasks 2–3: v3 device-pairing/recovery protocol, host device registry,
  grant consumption, public-key challenge/response, scope authorization, and
  device-specific revocation.
- Desktop Settings can show a native-device QR and paired-device management;
  the existing website setup QR/password remains unchanged.
- v2 website remote and v3 native remote can coexist against one enabled
  `remote_access_start` server.

**Exit gate:** automated host/protocol tests prove that a v2 browser token
still connects; a v3 device can only use its granted workspace/session; a
reused/expired QR fails; and revoking device A closes A without disrupting
device B or a browser session.

### Phase 2: Recovery semantics and iOS-ready Rust core

**Purpose:** Make a mobile network interruption routine rather than data loss.

**Deliverables:**

- Task 4: ping/pong, bounded 1/2/4-second reconnect effects, retry exhaustion,
  runtime-change detection, snapshot-required handling, and bounded output.
- Task 5: stable, tested C ABI that exposes state and effects to Swift.
- Buildable device + Apple-silicon Simulator Rust library artifacts.

**Exit gate:** deterministic Rust tests prove no duplicate output after
reconnect, `runtime_id` reset clears the affected terminal before snapshot
replay, and UI never needs to invent protocol/retry decisions. Static libraries
compile for both required iOS targets and the header compiles against them.

### Phase 3: Internal iOS vertical slice on Simulator and one development device

**Purpose:** Prove the real client, not just its Rust library.

**Deliverables:**

- Tasks 6–7: SwiftUI project, Rust bridge, Keychain, one URLSession WebSocket,
  QR/manual pairing, Pair/Connecting/Remote screens, input, resize, session
  selection, and reconnect UI.
- Task 8 packaging work through Simulator + development-device validation.
- iOS connects to the public HTTPS/WSS URL advertised by the desktop Remote
  Access settings. It may use LAN only in explicitly marked development tests.

**Exit gate:** on Simulator and one physical iPhone/iPad, the tester can:

1. Enable Remote Access in desktop Settings and scan its *native device* QR.
2. Pair once, kill/relaunch iOS, and reconnect from Keychain-stored identity.
3. Select an authorized terminal, see output, send input/Return, and resize.
4. Put the phone in airplane mode then recover without duplicate output.
5. Restart the desktop remote host and see terminal reset/replay.
6. Revoke the phone in desktop Settings and observe the iOS app return to Pair.

### Phase 4: TestFlight hardening and beta distribution

**Purpose:** Turn the validated development build into a safe external beta.

**Deliverables:**

- Production build settings: release-only WSS policy, app icon, privacy
  manifest/usage descriptions, Keychain behavior, crash/log redaction, bundle
  identifier, versioning, signing, and archive/export documentation.
- TestFlight-specific manual test matrix: cold install, upgrade, background,
  network changes, tunnel degraded/LAN fallback message, password-browser
  compatibility, revoked device, and forgotten desktop.
- Release candidate archive uploaded to App Store Connect and assigned to
  internal testers before external testing.

**Exit gate:** an internal TestFlight tester, using no development provisioning
profile, can pair to a desktop release/dev host through its public Remote
Access URL and complete the Phase 3 flow. App Review metadata and export
compliance are complete; no secrets, certificates, profiles, archives, or IPA
are committed.

### Phase 5: External TestFlight pilot and stabilization

**Purpose:** Validate real networks/devices before broader remote scope.

**Deliverables:**

- Small external TestFlight cohort, feedback route, and an operational guide
  for pairing/revoking/resetting a device.
- Observability that records only privacy-safe lifecycle counters/errors:
  pairing success/failure class, reconnect attempt/outcome, tunnel mode, and
  terminal recovery outcome—never terminal output, QR grants, tokens, paths,
  or device public keys in analytics payloads.
- Fixes limited to confirmed beta defects; terminal-emulator expansion, relay,
  preview tunnel, Android, and remote filesystem actions remain separate plans.

**Exit gate:** external testers can complete the TestFlight pairing and remote
terminal scenario across at least public-tunnel and LAN-fallback conditions,
with no unresolved authorization, credential-loss, or data-corruption defect.

## Risks And Recovery

- Device keys, pairing grants, session tokens, and password material are never
  logged, embedded in source, or retained in QR URLs after parsing.
- A non-loopback endpoint must use `wss`; reject `ws` in the iOS release build.
  `ws` exists only for explicit loopback development test configurations.
- iOS backgrounding may suspend the socket. Treat foreground resume as a
  reconnect trigger, not as proof that the former connection is usable.
- The P0 text renderer is intentionally not an ANSI terminal. Do not claim
  full terminal fidelity until a renderer decision and device validation exist.
- If the new pairing flow fails, revoke/disable only the device registry path;
  retain existing password-auth browser remote access during the transition.

## Progress

### Task 1: Record the remote-device and iOS transport decisions (Phase 0)

**Files:**

- Create: `docs/decisions/0010-remote-device-capabilities.md`
- Create: `docs/decisions/0011-ios-remote-transport-and-credentials.md`

- [ ] Specify `DeviceCapability` exactly: `workspace_id`, terminal policy
  (`AnyOwnedSession` or explicit IDs), `can_view`, `can_input`,
  `can_create_terminal`, `can_close_terminal`, `expires_at`, and `revoked_at`.
- [ ] Specify that P0 is exclusive controller ownership: a second device gets
  `session_occupied`; the host may later add an explicit takeover operation.
- [ ] Specify one-time QR grant fields: host key fingerprint, grant ID, expiry,
  requested device display name, and capability scope. The QR never contains a
  durable token or private key.
- [ ] Specify iOS transport policy: release builds accept only `wss`; the
  desktop public URL and LAN TLS endpoint must identify the host by its QR
  fingerprint before credentials are sent.
- [ ] Specify Keychain accessibility as
  `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, with migration/removal on
  device revoke or user “Forget desktop”.

### Task 2: Ship pairing and recovery as a tested shared protocol contract (Phase 1)

**Files:**

- Modify: `crates/terax-remote-protocol/src/lib.rs`
- Modify: `crates/terax-remote-protocol/tests/wire_contract.rs`
- Modify: `src/remote/protocol.ts`
- Modify: `src/remote/protocol.test.ts`
- Modify: `src-tauri/src/modules/remote_protocol.rs`

- [ ] Write the failing Rust/TypeScript tests for JSON envelopes containing
  `PairDevice`, `PairingChallenge`, `PairingProof`, `DeviceAuthenticated`,
  `Ping`, `Pong`, `SnapshotRequired`, `capability_denied`, and
  `session_occupied`.
- [ ] Keep the v2 browser contract working. Use a new `version: 3` envelope for
  device pairing rather than optional v2 fields that a browser could misread.
- [ ] Add explicit adapter errors for unknown version, expired pairing grant,
  revoked device, denied capability, occupied session, and missed output range.
- [ ] Run:

  ```bash
  cargo test --manifest-path crates/terax-remote-protocol/Cargo.toml
  pnpm vitest run src/remote/protocol.test.ts
  ```

  Expected: all protocol tests pass; v2 and v3 each reject unsupported peers.

### Task 3: Implement host device identity, grant consumption, and ACL checks (Phase 1)

**Files:**

- Create: `src-tauri/src/modules/remote_devices.rs`
- Create: `src-tauri/src/modules/remote_devices_test.rs`
- Modify: `src-tauri/src/modules/mod.rs`
- Modify: `src-tauri/src/modules/remote.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] Write failing tests for: grant expires; grant can be consumed once;
  malformed device proof is rejected; device registry persists public identity
  and scope; revoking device A leaves device B valid; revoked socket is closed.
- [ ] Implement an app-private registry storing only public device identity,
  display name, capability, timestamps, and revocation state with restrictive
  file permissions.
- [ ] Implement host challenge/response using a device public key and rotating
  short-lived session tokens. Keep browser password authentication unchanged
  during the migration.
- [ ] Centralize `authorize_device_operation(device, operation, workspace_id,
  session_id)` and call it before listing session metadata, attaching, reading
  output, input, resize, close, and terminal creation.
- [ ] Make session controller ownership explicit in the remote runtime and
  return protocol error `session_occupied` when another device controls it.
- [ ] Run:

  ```bash
  cd src-tauri && cargo test remote_devices
  cd src-tauri && cargo check --all-targets --locked
  cd src-tauri && cargo clippy --all-targets --locked -- -D warnings
  ```

  Expected: registry/auth/capability tests and checks pass.

### Task 4: Extend the Rust mobile lifecycle for Zedra-style recovery (Phase 2)

**Files:**

- Modify: `crates/terax-remote-client/src/lib.rs`
- Modify: `crates/terax-remote-client/tests/client_lifecycle.rs`
- Modify: `mobile/terax-mobile/src/lib.rs`
- Modify: `mobile/terax-mobile/tests/app_state.rs`

- [ ] Write failing tests for a foreground ping action, five missed pongs,
  retry effects at 1/2/4 seconds, retry exhaustion, host `runtime_id` change,
  `SnapshotRequired`, and bounded per-session terminal output.
- [ ] Add `RemoteClientAction::ScheduleReconnect { after_seconds, attempt }`,
  `Send(ClientMessage::Ping)`, and `ResetTerminal { session_id }`. The Rust
  state emits effects; it does not create timers or sockets.
- [ ] Make `TeraxMobileApp` expose screen-ready reconnect information and cap
  each session buffer at a named fixed byte budget. On reset, clear only the
  affected buffer, then apply the incoming snapshot.
- [ ] Preserve attach continuation through `(runtime_id, session_id, sequence)`:
  reconnect attaches from the last sequence; runtime change or missed range
  attaches from zero and emits `ResetTerminal`.
- [ ] Run:

  ```bash
  cargo test --manifest-path crates/terax-remote-client/Cargo.toml
  cargo test --manifest-path mobile/Cargo.toml -p terax-mobile
  cargo clippy --manifest-path mobile/Cargo.toml -p terax-mobile --all-targets -- -D warnings
  ```

  Expected: lifecycle and mobile-state tests pass without a mobile runtime.

### Task 5: Add a narrow Rust C ABI for Swift (Phase 2)

**Files:**

- Create: `mobile/terax-mobile/src/ffi.rs`
- Create: `mobile/terax-mobile/include/terax_mobile.h`
- Modify: `mobile/terax-mobile/src/lib.rs`
- Modify: `mobile/terax-mobile/Cargo.toml`
- Create: `mobile/terax-mobile/tests/ffi_contract.rs`

- [ ] Write Rust tests that create an opaque app handle, submit a JSON pairing
  intent, submit decoded server-message JSON, return JSON state/effects, and
  free every returned string exactly once.
- [ ] Export only these C functions:

  ```c
  TeraxMobileHandle *terax_mobile_new(void);
  void terax_mobile_free(TeraxMobileHandle *handle);
  char *terax_mobile_dispatch(TeraxMobileHandle *handle, const char *intent_json);
  void terax_mobile_string_free(char *value);
  ```

  `terax_mobile_dispatch` returns a JSON object with `state`, `effects`, and
  one structured error code; it must reject invalid UTF-8/JSON without panic.
- [ ] Keep opaque-handle access serialized by the Swift `@MainActor` model;
  do not mark the Rust state `Send` or share one handle across threads.
- [ ] Add a C header compile smoke test against the generated static library.
- [ ] Run `cargo test --manifest-path mobile/Cargo.toml -p terax-mobile` and
  `cargo build --manifest-path mobile/Cargo.toml -p terax-mobile --lib`.

### Task 6: Create the SwiftUI iOS host and secure platform adapter (Phase 3)

**Files:**

- Create: `mobile/ios/TeraxMobile.xcodeproj/project.pbxproj`
- Create: `mobile/ios/TeraxMobile/TeraxMobileApp.swift`
- Create: `mobile/ios/TeraxMobile/AppModel.swift`
- Create: `mobile/ios/TeraxMobile/RustBridge.swift`
- Create: `mobile/ios/TeraxMobile/KeychainStore.swift`
- Create: `mobile/ios/TeraxMobile/PairingScanner.swift`
- Create: `mobile/ios/TeraxMobile/ContentView.swift`
- Create: `mobile/ios/TeraxMobileTests/AppModelTests.swift`

- [ ] Create the Xcode target with no remote service credentials, team ID, or
  provisioning profile committed. Set its deployment target to the current
  repository-approved iOS baseline and use a placeholder development bundle ID
  provided via local Xcode build settings.
- [ ] Implement `RustBridge` around the four C functions from Task 5; decode
  every result into typed Swift `Codable` state/effect structures.
- [ ] Implement `KeychainStore` with set/get/delete operations and ensure its
  tests use an injected Keychain protocol, never production Keychain state.
- [ ] Implement `AppModel` as `@MainActor ObservableObject`: it owns exactly
  one `URLSessionWebSocketTask`, sends only `Send` effects from Rust, schedules
  only `ScheduleReconnect` effects, invokes `socket_opened/socket_lost` intents,
  and deletes credentials when Rust emits revoked/unauthorized state.
- [ ] On `scenePhase` foreground, request a reconnect; on background, cancel
  the socket and leave persistent credentials in Keychain. Do not keep a
  background socket alive.
- [ ] Add unit tests with a fake socket and fake Keychain that prove no send
  occurs before Rust emits a send effect, only one socket is active, reconnect
  delay is obeyed, and revocation deletes the stored device credential.

### Task 7: Build Pair, Connecting, and Remote SwiftUI screens (Phase 3)

**Files:**

- Create: `mobile/ios/TeraxMobile/PairDeviceView.swift`
- Create: `mobile/ios/TeraxMobile/ConnectingView.swift`
- Create: `mobile/ios/TeraxMobile/RemoteTerminalView.swift`
- Create: `mobile/ios/TeraxMobile/SessionPickerView.swift`
- Create: `mobile/ios/TeraxMobileTests/RemoteTerminalViewTests.swift`

- [ ] Pair screen accepts a QR payload through `DataScannerViewController` when
  available and offers typed endpoint/grant fallback. Parse once, remove the QR
  payload from visible state, and dispatch only normalized pairing intent JSON
  to Rust.
- [ ] Connecting screen renders connection state, retry attempt/countdown, host
  name/fingerprint, and a “Forget desktop” action that deletes Keychain data
  and resets the Rust app handle.
- [ ] Remote screen lists only host-authorized sessions; selecting one executes
  Rust attach effects. It presents an accessibility-labelled input field that
  sends `\\r` for Return, sends resize changes with debounce, and shows a
  controller-occupied error without retrying input.
- [ ] Use a `Text`/`ScrollView` output display with the Rust buffer budget.
  Render control/ANSI bytes visibly escaped in P0 rather than pretending to be
  a terminal emulator.
- [ ] Add view tests for Pair/Connecting/Remote transitions, denied capability,
  occupied session, reconnect display, and output reset after snapshot.

### Task 8: Package Rust correctly and validate the vertical slice (Phases 3–4)

**Files:**

- Modify: `mobile/README.md`
- Modify: `docs/mobile/ios-first-build.md`
- Modify: `docs/MANUAL_TEST.md`

- [ ] Add a reproducible script or Xcode build phase that builds
  `aarch64-apple-ios` and `aarch64-apple-ios-sim` Rust static libraries,
  packages `TeraxMobile.xcframework`, and copies it into ignored build output.
- [ ] Verify the XCFramework header matches Task 5 and is consumed by the
  Swift target. Never commit the XCFramework, archive, IPA, token, certificate,
  provisioning profile, or Apple team identifier.
- [ ] Add manual test cases: first pairing, QR reuse rejection, per-device
  revoke, denied terminal operation, session occupied, airplane-mode recovery,
  host restart recovery, snapshot reset, and forgetting a desktop.
- [ ] Run:

  ```bash
  cargo test --manifest-path crates/terax-remote-protocol/Cargo.toml
  cargo test --manifest-path crates/terax-remote-client/Cargo.toml
  cargo test --manifest-path mobile/Cargo.toml -p terax-mobile
  pnpm vitest run src/remote/protocol.test.ts src/remote/remoteClient.test.ts
  pnpm build
  cd src-tauri && cargo check --all-targets --locked
  xcodebuild -project mobile/ios/TeraxMobile.xcodeproj -scheme TeraxMobile -sdk iphonesimulator -destination 'platform=iOS Simulator,name=<installed device>' test
  ```

  Expected: unit/build checks pass; Simulator pairs with a development host and
  can render/recover an authorized terminal.

## Decisions

- 2026-08-12: iOS is the first native target. Android starts only after this
  vertical slice is validated on Simulator and one physical device.
- 2026-08-12: Use SwiftUI, URLSession WebSocket, AVFoundation/Apple scanning,
  and Keychain APIs to avoid adding an unreviewed mobile dependency.
- 2026-08-12: Use a small C ABI rather than a new binding generator dependency.
- 2026-08-12: Apply Zedra's identity/ACL/reconnect lessons before persisting
  credentials on iOS; defer Zedra's Iroh transport and web-tunnel layers.
- 2026-08-12: P0 terminal is output-plus-input, not a full ANSI terminal.

## Validation

- Focused proof: protocol, host device registry, capability, lifecycle, Rust
  ABI, Swift model, Keychain abstraction, and SwiftUI screen tests.
- Integration proof: paired Simulator can connect to one authorized terminal;
  a revoked device immediately loses access; reconnect after host restart
  resets/replays terminal state without duplicated output.
- Repository checks: Rust tests/Clippy, `pnpm build`, `cargo check`, and iOS
  Simulator test command in Task 8.

## Result

Not started. Record completed task evidence and unresolved device-specific
limitations here before moving this plan to `docs/plans/completed/`.
