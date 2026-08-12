# cmdSpace native mobile

This directory reserves the native mobile application surface for cmdSpace
remote access. It contains cmdSpace-authored application state only.

The future iOS and Android client depends on `crates/cmdspace-remote-protocol` for
the versioned remote wire contract. It must not depend on `src-tauri`: the
desktop host owns terminal processes, device-local credentials, and the remote
WebSocket transport.

## Initial boundary

- `crates/cmdspace-remote-protocol`: shared messages, envelope validation, and UTF-8
  stream decoding.
- `crates/cmdspace-remote-client`: native-client lifecycle state. It converts user
  intents and decoded server messages into explicit actions.
- `src-tauri`: desktop host adapter and PTY/session authority.
- `mobile`: future native client adapter, rendering and input only.

## Platform adapter contract

The platform adapter owns exactly one WebSocket. It passes decoded
`ServerMessage` values to `RemoteClient::handle` and sends every
`RemoteClientAction::Send` value with the shared protocol envelope. It renders
`TerminalData`, persists the token using each platform's secure storage, and
handles reconnect scheduling. It must not create PTYs or depend on `src-tauri`.

## Current app foundation

`mobile/` is an independent Cargo workspace and depends only on local cmdSpace
crates. No external UI source is pinned or vendored here.

```bash
cargo test --manifest-path mobile/Cargo.toml -p cmdspace-mobile
```

A UI/runtime dependency will be selected only after its license and
distribution terms are explicitly reviewed.

For the first iOS artifact and app-host path, see
[`docs/mobile/ios-first-build.md`](../docs/mobile/ios-first-build.md). The
runbook distinguishes the Rust library that can be built now from the iOS host,
Rust bridge, and signing work that are still required for an installable app.

## Current pairing state

`cmdspace-mobile` owns the pairing flow: it validates a `ws://` or `wss://`
endpoint, normalizes it to `/api/remote/ws`, does not persist the token, and
surfaces Pair device, Connecting, and Remote screens for a future platform UI
adapter to render.

The Remote state also retains session metadata and ordered terminal output from
the shared client actions. The future UI adapter should render these values; it
must not recreate protocol sequencing or output de-duplication.
