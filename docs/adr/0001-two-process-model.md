# ADR 0001: Two-Process Model — Webview Never Touches the OS

Status: accepted
Date: 2026-08-05

## Context

cmdSpace is a desktop ADE whose UI is a webview. The webview can read the
filesystem, spawn processes, and poke at shells if we let it. That is a
privilege and safety nightmare: arbitrary React code (or a compromised renderer)
would get raw OS access, and the JS/TS side cannot manage long-lived native
resources (PTYs, process trees, keychains) reliably.

## Decision

The Rust layer (`src-tauri/`) owns **all** OS access. The webview never touches
the filesystem, processes, or shells directly — every privileged operation goes
through `invoke()` to a command registered in `src-tauri/src/lib.rs`, and the
frontend calls those commands through a small set of typed clients
(`src/modules/ai/lib/native.ts`, `src/modules/terminal/lib/pty-bridge.ts`).

New commands are registered in `lib.rs::run()` via `invoke_handler` and their
permissions added in `src-tauri/capabilities/`.

## Consequences

- The webview stays sandboxed behind Tauri's capability allowlist.
- Resource lifecycle (PTY sessions, job objects, background processes) is
  enforceable in Rust where destructors run deterministically.
- Every new privileged capability is a reviewable Rust command + capability
  entry, not an ad-hoc IPC channel.
- Slightly more boilerplate: adding a feature often means touching both layers.

## Rejected Alternatives

- Direct `node/fs` or shell access from the webview — rejected for safety and
  lifecycle reasons.
- A parallel IPC path (WebSocket, custom protocol) alongside `invoke` —
  rejected: it would bypass the capability allowlist and split the contract.

## Verification

- CI runs `cargo check --all-targets --locked` + clippy on `src-tauri`.
- Code review gate: any new frontend code that touches `fs`/`process`/shell
  globals instead of an `invoke` client is a merge blocker.
- `tauri.conf.test.ts` guards config-level invariants (CSP, capabilities).
