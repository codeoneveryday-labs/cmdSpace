# Native Mobile Client Core Implementation Plan

**Outcome:** Provide a testable Rust state core for the native iOS/Android remote client, independent of UI and transport.

**Context:** `crates/terax-remote-protocol` is the shared v2 protocol contract. The desktop remote web client already proves desired lifecycle behavior: authenticate after hello, attach one selected session, deduplicate output, and reattach from sequence zero after a host runtime restart.

**Approach:** Add one dependency-free Rust crate, `terax-remote-client`. It returns explicit actions for a later GPUI/WebSocket adapter rather than performing network or platform work internally.

**Risks and recovery:** This is additive and does not alter the desktop remote host. Reverting its commit removes the new client crate without changing the protocol crate or Tauri dependency graph.

## Progress

- [x] Add lifecycle tests for the pure client controller.
- [x] Implement controller state and actions.
- [x] Document the GPUI adapter contract.
- [x] Validate the new crate, existing protocol consumers, and desktop build.

## Decisions

- Keep transport out of this phase because the repository has no approved mobile WebSocket/runtime dependency yet.
- Keep a single active terminal attachment, matching the existing remote client and mobile screen constraints.

## Validation

- `cargo test --manifest-path crates/terax-remote-client/Cargo.toml`
- `cargo test --manifest-path crates/terax-remote-protocol/Cargo.toml`
- `pnpm vitest run src/remote/remoteClient.test.ts src/remote/protocol.test.ts`
- `cd src-tauri && cargo check --all-targets --locked`
- `pnpm build`

## Result

The native-client core is implemented in `crates/terax-remote-client`. Its
five lifecycle tests pass alongside the shared protocol tests, existing web
remote-client tests, Tauri checks, and the frontend production build.
