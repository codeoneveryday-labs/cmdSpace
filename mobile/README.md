# Terax native mobile

This directory reserves the native mobile application surface for Terax remote
access. It contains Terax-authored application state only.

The future iOS and Android client depends on `crates/terax-remote-protocol` for
the versioned remote wire contract. It must not depend on `src-tauri`: the
desktop host owns terminal processes, device-local credentials, and the remote
WebSocket transport.

## Initial boundary

- `crates/terax-remote-protocol`: shared messages, envelope validation, and UTF-8
  stream decoding.
- `crates/terax-remote-client`: native-client lifecycle state. It converts user
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

`mobile/` is an independent Cargo workspace and depends only on local Terax
crates. No external UI source is pinned or vendored here.

```bash
cargo test --manifest-path mobile/Cargo.toml -p terax-mobile
```

A UI/runtime dependency will be selected only after its license and
distribution terms are explicitly reviewed.
