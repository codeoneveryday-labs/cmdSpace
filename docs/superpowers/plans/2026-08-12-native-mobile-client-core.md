# Native Mobile Client Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a platform-neutral Rust state core for the future native Terax remote app.

**Architecture:** `terax-remote-client` converts protocol messages and user intents into explicit actions. A future platform/WebSocket adapter executes `Send` actions and renders `TerminalData`; it never embeds transport or UI concerns in the controller.

**Tech Stack:** Rust 2021, `terax-remote-protocol`, standard library collections.

---

### Task 1: Specify the remote client lifecycle

**Files:**
- Create: `crates/terax-remote-client/tests/client_lifecycle.rs`

- [x] **Step 1: Write lifecycle tests**

```rust
assert_eq!(client.handle(ServerMessage::Hello { authenticated: false, runtime_id: 1 }),
    vec![RemoteClientAction::Send(ClientMessage::Auth { token: "token".into() })]);
```

- [x] **Step 2: Run the tests before implementation**

Run: `cargo test --manifest-path crates/terax-remote-client/Cargo.toml`

Expected: FAIL because the new client crate is absent.

### Task 2: Implement the pure client controller

**Files:**
- Create: `crates/terax-remote-client/Cargo.toml`
- Create: `crates/terax-remote-client/src/lib.rs`
- Test: `crates/terax-remote-client/tests/client_lifecycle.rs`

- [x] **Step 1: Add the local protocol dependency**

```toml
terax-remote-protocol = { path = "../terax-remote-protocol" }
```

- [x] **Step 2: Add state, effects, and lifecycle transitions**

```rust
pub enum RemoteClientAction { Send(ClientMessage), TerminalData { session_id: u64, sequence: u64, data: String } }
pub struct RemoteClient { /* protocol state only */ }
```

- [x] **Step 3: Run the lifecycle tests**

Run: `cargo test --manifest-path crates/terax-remote-client/Cargo.toml`

Expected: PASS.

### Task 3: Publish the platform adapter boundary

**Files:**
- Modify: `mobile/README.md`
- Modify: `docs/plans/active/2026-08-12-native-mobile-client-core.md`

- [x] **Step 1: Describe platform adapter responsibilities**

```text
The adapter delivers decoded ServerMessage values to RemoteClient and executes Send actions over one WebSocket.
```

- [x] **Step 2: Run validation**

Run: `cargo test --manifest-path crates/terax-remote-client/Cargo.toml && cargo test --manifest-path crates/terax-remote-protocol/Cargo.toml && pnpm vitest run src/remote/remoteClient.test.ts src/remote/protocol.test.ts && (cd src-tauri && cargo check --all-targets --locked) && pnpm build`

Expected: PASS.
