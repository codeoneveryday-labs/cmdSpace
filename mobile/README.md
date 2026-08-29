# cmdSpace native mobile

This directory holds the native mobile application surface for cmdSpace remote
access. The current client is Swift-only and targets iOS; an Android adapter is
not yet implemented.

The iOS client depends on `crates/cmdspace-remote-protocol` for the versioned
remote wire contract. It must not depend on `src-tauri`: the desktop host owns
terminal processes, device-local credentials, and the remote WebSocket
transport.

## Layout

| Path | Role |
| --- | --- |
| `crates/cmdspace-remote-protocol` | Shared messages, envelope validation, and UTF-8 stream decoding. |
| `crates/cmdspace-remote-client` | Native-client lifecycle state (pairing, session, terminal intent sequencing). |
| `mobile/ios/CmdSpaceMobileCore` | Swift Package: typed pairing payloads, device identity, wire envelopes, terminal display/input normalization. |
| `mobile/ios/CmdSpaceMobileApp` | SwiftUI app host: one WebSocket in `RemoteStore`, Keychain-backed identity, camera QR, workspace/terminal UI. |
| `src-tauri` | Desktop host adapter and PTY/session authority. |

## Platform adapter contract

The platform adapter owns exactly one WebSocket. It passes decoded
`ServerMessage` values to the client state and sends every
`RemoteClientAction::Send` value with the shared protocol envelope. It renders
`TerminalData`, persists the device identity using each platform's secure
storage, and handles reconnect scheduling. It must not create PTYs or depend on
`src-tauri`.

On iOS this contract is implemented by
`mobile/ios/CmdSpaceMobileApp/RemoteStore.swift`: it owns the single
`URLSessionWebSocketTask`, reads published state, and forwards typed pairing and
wire envelopes from `CmdSpaceMobileCore`.

## Current app foundation

`mobile/` is an independent Cargo workspace and depends only on local cmdSpace
crates. No external UI source is pinned or vendored here.

```bash
cargo test --manifest-path mobile/Cargo.toml -p cmdspace-mobile
```

The iOS client is a separate Swift workspace under `mobile/ios/`:

```bash
swift build --package-path mobile/ios/CmdSpaceMobileCore
swift test --package-path mobile/ios/CmdSpaceMobileCore
```

For the iOS build and archive path, see
[`docs/mobile/ios-first-build.md`](../docs/mobile/ios-first-build.md). The
runbook covers the Swift core checks, `xcodegen` project generation, Simulator
builds, physical-device archive, and the manual pairing smoke test.

## Current pairing state

The iOS client owns the pairing flow. It validates the `cmdspace://device-pair`
payload, normalizes it to the `wss://…/api/remote/device/ws` endpoint, creates a
single Curve25519 identity in Keychain, and persists only the device identity
and connection metadata. Pairing grants and terminal tokens are never saved.

The client supports camera QR scanning via `VisionKit`, with a paste field as a
fallback when the camera is unavailable (including some Simulator setups).

`CmdSpaceMobileCore` retains session metadata and ordered terminal output from
the shared client actions. The SwiftUI host renders these values; it must not
recreate protocol sequencing or output de-duplication.
