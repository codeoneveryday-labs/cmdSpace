# iOS Native Remote Client

Date: 2026-08-12

## Status

In progress — Simulator build and app launch validated; pairing smoke test remains.

## Outcome

Create a cmdSpace-branded SwiftUI iOS remote client source surface that pairs to
the desktop's native-device v3 endpoint, persists only its device identity,
and renders a terminal-first remote workspace.

## Context

- `docs/decisions/0010-remote-device-capabilities.md`
- `docs/decisions/0011-ios-remote-transport-and-credentials.md`
- `src-tauri/src/modules/remote.rs`
- `crates/cmdspace-remote-protocol/src/lib.rs`

## Scope

In scope:

- cmdSpace SwiftUI app host and source package.
- QR payload decoding, Keychain identity, v3 pairing/authentication, and
  WebSocket lifecycle.
- Home, pairing, terminal, and workspace drawer UI inspired by Zedra's
  terminal-first information hierarchy but using only cmdSpace branding.

Out of scope:

- Apple developer signing credentials, archive upload, or TestFlight upload.
- File editor, diff, Markdown, and desktop-workspace sharing.

## Approach

The iOS source owns the WebSocket and Keychain identity. It speaks the v3
JSON envelope directly so the desktop is the authorization point. SwiftUI
renders a narrow app model with connection and terminal state; no Zedra source
or assets are imported.

## Risks And Recovery

- Simulator compilation and launch are now validated with full Xcode. Physical-device
  signing, archive upload, and TestFlight distribution remain intentionally out of scope.
- The host endpoint currently uses a fresh signed challenge per WebSocket.
  The client must never persist pairing grants.
- A live desktop host is required to perform the final QR pairing and terminal
  interaction smoke test.

## Progress

- [x] Add testable protocol and pairing models.
- [x] Implement pairing identity and WebSocket transport.
- [x] Add cmdSpace SwiftUI terminal-first host.
- [x] Add XcodeGen project specification and app icon reference.
- [x] Generate, build, install, and launch the iOS app on the iPhone 17 Pro Simulator.
- [x] Rename every mobile/iOS-owned identifier and artifact to cmdSpace.

## Decisions

- 2026-08-12: Reuse only the cmdSpace app icon; Zedra is visual reference
  only, not a source or asset dependency.
- 2026-08-12: Use a Swift-native v3 adapter rather than a Rust C bridge in the
  first iOS host. It keeps Keychain, CryptoKit, VisionKit and URLSession at the
  platform boundary while the desktop remains protocol/authority owner.
- 2026-08-12: cmdSpace is the sole product and technical name for this remote
  foundation; all owned protocol/client/mobile crates use the `cmdspace-*` name.

## Validation

- Swift package tests for pairing and v3 envelope handling.
- Native-device WebSocket pairing and reconnect integration tests on the
  desktop host.
- `xcodebuild` Simulator build when full Xcode is available.
- Rust protocol and desktop checks remain green.

## Result

The Swift package core builds and its executable protocol check passes. The
XcodeGen project builds successfully for the iPhone 17 Pro Simulator; the
installed app launches to the cmdSpace pairing home screen. Camera scanning,
desktop pairing, and archive/TestFlight proof remain pending a live host and
Apple signing authority.

The desktop host integration tests execute the native v3 sequence end-to-end:
challenge, one-time signed QR pair, signed authentication, session list, and
subsequent reconnect using a fresh challenge without reusing the QR grant.
Apple documents `Curve25519.Signing` as Ed25519, the same signature scheme
verified by the desktop's `ed25519-dalek` registry.
