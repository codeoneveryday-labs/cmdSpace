# Terax native mobile

This directory reserves the native mobile adapter surface for Terax remote access.

The future iOS and Android client will use a native Rust UI/runtime stack inspired by
Zedra, while depending on `crates/terax-remote-protocol` for the versioned remote
wire contract. It must not depend on `src-tauri`: the desktop host owns terminal
processes, device-local credentials, and the remote WebSocket transport.

## Initial boundary

- `crates/terax-remote-protocol`: shared messages, envelope validation, and UTF-8
  stream decoding.
- `src-tauri`: desktop host adapter and PTY/session authority.
- `mobile`: future native client adapter, rendering and input only.

The first mobile implementation phase will add the native shell and platform
adapters without changing the protocol contract established here.
