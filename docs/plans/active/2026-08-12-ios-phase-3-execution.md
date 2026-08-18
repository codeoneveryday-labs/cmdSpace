# iOS Phase 3 — Internal Remote Vertical Slice

## Outcome

Validate cmdSpace as a real native iOS remote client on the iPhone 17 Pro
Simulator and one development device. The client pairs through the desktop's
native-device QR, persists only its device identity in Keychain, connects via
the desktop-advertised public WSS endpoint, and controls one authorized
terminal through disconnect, recovery, host restart, and revocation.

## Scope and authority

- The existing phase definition in
  `docs/plans/active/2026-08-12-ios-mobile-remote-vertical-slice.md:169`
  is authoritative.
- `mobile/ios/CmdSpaceMobileApp/RemoteStore.swift` owns the one iOS WebSocket,
  UI-facing connection state, and effects from the mobile core.
- `mobile/ios/CmdSpaceMobileCore/` owns typed pairing/wire payload validation;
  Keychain remains the only secret persistence location.
- The desktop remains authorization authority. iOS must never select an
  ungranted workspace or session, nor recreate protocol/retry policy locally.

## Plan

1. Lock the Phase 3 protocol boundary and test fixtures.
   - Compare the Swift `DeviceEnvelope`, pairing payload, and wire-message
     types with the current desktop remote contract before extending UI.
   - Add focused core tests for malformed/expired pairing input and recovery
     envelopes.
   - Verify: `swift test --package-path mobile/ios/CmdSpaceMobileCore`.

2. Complete pairing and identity lifecycle.
   - Exercise camera QR and manual input through the same parser.
   - Verify Keychain-backed relaunch reconnect, explicit revoked-device reset,
     and a useful failure/re-pair state without logging credentials.
   - Verify: Simulator tests plus manual kill/relaunch test.

3. Harden the single WebSocket lifecycle in `RemoteStore`.
   - Use only the advertised public `wss` endpoint outside explicit loopback
     development tests.
   - Cover connecting, heartbeat, bounded reconnect, foreground resume, host
     restart, runtime reset/snapshot replay, and retry exhaustion.
   - Verify: deterministic core tests and controlled Simulator network/host
     interruption checks.

4. Finish terminal control flows.
   - Validate authorized-session selection, bounded output rendering, text
     input/Return, terminal resize, and reconnect status without duplicating
     desktop capabilities in SwiftUI.
   - Verify: a real desktop session receives typed input and renders output;
     resize produces one intended remote update.

5. Validate the end-to-end acceptance script on both targets.
   - Simulator: pair, relaunch, attach, input, resize, network recovery, host
     restart, and revocation.
   - Development device: repeat the same script through public WSS; LAN is
     recorded only as a development exception.
   - Verify: capture a dated manual-test record with results for all six Phase
     3 exit-gate scenarios.

6. Prepare Phase 4 handoff only after the gate passes.
   - Record remaining signing, privacy-manifest, archive, and TestFlight work;
     do not begin distribution or weaken WSS/Keychain policy during Phase 3.

## Acceptance criteria

- The complete six-step Phase 3 exit gate passes on Simulator and one physical
  development device.
- Pairing credentials are never stored outside Keychain or logged.
- A non-loopback release path rejects `ws` and uses the desktop's advertised
  public WSS URL.
- Interrupted connectivity recovers without duplicate terminal output.
- Revocation returns the app to pairing and prevents renewed remote control.
- iOS build succeeds and focused Swift core tests pass before every device run.

## Progress

- Completed: manual Simulator pairing authenticates through the native-device
  WebSocket. The client now sends JSON in text frames, matching the desktop
  protocol.
- Completed: terminal drawer refreshes authorized sessions, presents a clear
  empty/loading state, and can create then attach a capability-authorized
  remote terminal.
- Completed: a revoked native identity can consume a fresh pairing grant and
  replace its revoked desktop registry entry without creating a duplicate.
- Completed: the remote terminal has a content-first iOS shell and strips
  ANSI/OSC shell-integration control sequences before rendering text output.
- Completed: the native-device protocol now provides the three most recently
  used standard workspaces from the desktop SQLite store; iOS caches only that
  metadata and opens a selected workspace with a standard terminal context.
- Completed: Home uses workspace-first navigation, a single Connect action,
  and an inline offline device state rather than a detached error banner.
- Next: manually verify recent-workspace refresh against a rebuilt desktop,
  then add the workspace terminal creation form (title and agent CLI).

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Simulator masks device lifecycle or camera behavior | Repeat every acceptance scenario on one physical device. |
| Client invents protocol decisions | Keep wire/retry semantics in the shared mobile core and desktop contract. |
| Credentials leak through storage or diagnostics | Keychain-only persistence and redacted logging review. |
| Public tunnel/network flakiness is mistaken for app success | Record endpoint, network state, and recovery outcome for every manual run. |

## Verification commands

```sh
xcodegen generate --spec mobile/ios/project.yml --project mobile/ios
xcodebuild -project mobile/ios/CmdSpaceMobile.xcodeproj -scheme CmdSpaceMobile -sdk iphonesimulator -configuration Debug build
swift test --package-path mobile/ios/CmdSpaceMobileCore
```
