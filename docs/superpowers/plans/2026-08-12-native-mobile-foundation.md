# Native Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a reusable Rust remote-protocol module for the future native iOS/Android client without altering current desktop behavior.

**Architecture:** A framework-free `terax-remote-protocol` crate becomes the protocol seam. `src-tauri` retains a re-export adapter so its WebSocket server and existing tests keep their local module path while mobile gains a stable crate dependency.

**Tech Stack:** Rust 2021, serde, serde_json test fixtures, Tauri 2 desktop adapter.

---

### Task 1: Lock the shared wire contract

**Files:**
- Create: `crates/terax-remote-protocol/Cargo.toml`
- Create: `crates/terax-remote-protocol/src/lib.rs`
- Create: `crates/terax-remote-protocol/tests/wire_contract.rs`

- [x] **Step 1: Write contract tests**

```rust
assert_eq!(json["version"], REMOTE_PROTOCOL_VERSION);
assert_eq!(json["message"]["sessionId"], 7);
```

- [x] **Step 2: Run the crate test before implementation**

Run: `cargo test --manifest-path crates/terax-remote-protocol/Cargo.toml`

Expected: FAIL because the crate has not been created.

- [x] **Step 3: Implement the framework-free protocol crate**

```rust
pub const REMOTE_PROTOCOL_VERSION: u16 = 2;
pub enum ClientMessage { Input { session_id: u64, data: String }, /* … */ }
```

- [x] **Step 4: Run the crate tests**

Run: `cargo test --manifest-path crates/terax-remote-protocol/Cargo.toml`

Expected: PASS.

### Task 2: Keep desktop as the protocol adapter

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/modules/remote_protocol.rs`
- Test: `src-tauri/src/modules/remote_protocol_test.rs`

- [x] **Step 1: Add the path dependency**

```toml
terax-remote-protocol = { path = "../crates/terax-remote-protocol" }
```

- [x] **Step 2: Replace the Tauri-local implementation with a re-export adapter**

```rust
pub use terax_remote_protocol::*;
```

- [x] **Step 3: Run desktop protocol and crate checks**

Run: `cd src-tauri && cargo test remote_protocol_test && cargo check --all-targets --locked`

Expected: PASS.

### Task 3: Document the next mobile platform seam

**Files:**
- Create: `mobile/README.md`

- [x] **Step 1: Record the mobile crate contract**

```text
The future mobile adapter depends on terax-remote-protocol and never on src-tauri.
```

- [x] **Step 2: Run complete validation**

Run: `cargo test --manifest-path crates/terax-remote-protocol/Cargo.toml && pnpm vitest run src/remote/protocol.test.ts && (cd src-tauri && cargo check --all-targets --locked) && pnpm build`

Expected: PASS.
