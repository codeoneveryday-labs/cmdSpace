# Terax native mobile

This directory reserves the native mobile adapter surface for Terax remote access.

The future iOS and Android client will use a native Rust UI/runtime stack inspired by
Zedra, while depending on `crates/terax-remote-protocol` for the versioned remote
wire contract. It must not depend on `src-tauri`: the desktop host owns terminal
processes, device-local credentials, and the remote WebSocket transport.

## Initial boundary

- `crates/terax-remote-protocol`: shared messages, envelope validation, and UTF-8
  stream decoding.
- `crates/terax-remote-client`: native-client lifecycle state. It converts user
  intents and decoded server messages into explicit actions.
- `src-tauri`: desktop host adapter and PTY/session authority.
- `mobile`: future native client adapter, rendering and input only.

## GPUI adapter contract

The platform adapter owns exactly one WebSocket. It passes decoded
`ServerMessage` values to `RemoteClient::handle` and sends every
`RemoteClientAction::Send` value with the shared protocol envelope. It renders
`TerminalData`, persists the token using each platform's secure storage, and
handles reconnect scheduling. It must not create PTYs or depend on `src-tauri`.

The first mobile implementation phase will add the native shell and platform
adapters without changing the protocol contract established here.
