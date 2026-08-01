# clsh-style Remote Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace cmdSpace's pairing-based, multi-socket remote shell with password authentication and a fast single-terminal client modeled on clsh.

**Architecture:** Keep the Tauri/Rust PTY and tunnel owner, but introduce a password-backed auth state, protocol v2 UTF-8 output, one browser WebSocket client with session routing, and one mounted WebGL xterm renderer. The remote UI becomes a focused terminal/session-grid application at every viewport size.

**Tech Stack:** Rust, Tauri v2, tungstenite, scrypt, React 19, TypeScript, xterm.js, WebGL addon, Vitest, Tailwind CSS.

---

## File map

- `src-tauri/src/modules/remote_auth.rs`: password verifier, bootstrap setup authorization, login rate limiting, signed tokens.
- `src-tauri/src/modules/remote_auth_test.rs`: auth red/green tests.
- `src-tauri/src/modules/remote.rs`: password HTTP endpoints, QR bootstrap URL, one-connection multi-session subscriptions, UTF-8 output.
- `src-tauri/src/modules/remote_protocol.rs`: protocol v2 message shapes.
- `src-tauri/src/modules/remote_protocol_test.rs`: serialization compatibility tests.
- `src/modules/settings/remoteAccess.ts`: password-oriented remote status API.
- `src/settings/sections/GeneralSection.tsx`: QR/public URL only; no pairing code controls.
- `src/remote/auth.ts`: browser auth status/setup/login/token helpers.
- `src/remote/remoteClient.ts`: shared WebSocket lifecycle and session message bus.
- `src/remote/terminalOutput.ts`: animation-frame output batching.
- `src/remote/RemoteTerminal.tsx`: one xterm/WebGL renderer.
- `src/remote/RemoteKeyboard.tsx`: touch keyboard and context strip.
- `src/remote/RemoteApp.tsx`: auth, picker, session grid, and focused terminal screens.
- `src/remote/remote.css`: isolated full-screen remote styling.
- `src/remote/*.test.ts`: behavior and source contracts.

### Task 1: Password auth core

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/modules/remote_auth.rs`
- Modify: `src-tauri/src/modules/remote_auth_test.rs`

- [ ] **Step 1: Write failing password tests**

Add tests proving that setup requires a valid single-use bootstrap token, passwords shorter than eight characters are rejected, a stored scrypt verifier accepts the right password, rejects the wrong password, and login rate limiting remains active.

```rust
#[test]
fn bootstrap_sets_password_once_and_password_login_issues_tokens() {
    let mut auth = RemoteAuth::from_material("bootstrap", [7; 32], 2_000, 3_600);
    auth.setup_password("bootstrap", "correct horse", 1_000).unwrap();
    assert!(auth.password_configured());
    assert!(auth.authenticate_password("correct horse", "phone", 1_001).is_ok());
    assert_eq!(auth.authenticate_password("wrong horse", "phone", 1_002), Err(RemoteAuthError::InvalidPassword));
}
```

- [ ] **Step 2: Run red test**

Run: `cargo test --manifest-path src-tauri/Cargo.toml remote_auth_test -- --nocapture`
Expected: failure because password APIs and error variants do not exist.

- [ ] **Step 3: Add scrypt and minimal password implementation**

Use random 16-byte salts, scrypt recommended parameters, encoded verifier storage in auth state, and constant-time verification supplied by the crate. Keep the hidden bootstrap token single-use and remove user-facing pairing terminology from errors.

- [ ] **Step 4: Run green test**

Run the command from Step 2 and expect all remote auth tests to pass.

### Task 2: Password HTTP flow and Settings cleanup

**Files:**
- Modify: `src-tauri/src/modules/remote.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/modules/settings/remoteAccess.ts`
- Modify: `src/settings/sections/GeneralSection.tsx`
- Modify: `src/settings/sections/GeneralSection.source.test.ts`
- Modify: `src/remote/RemoteApp.source.test.ts`

- [ ] **Step 1: Write failing source and Rust endpoint tests**

Require `/api/remote/auth/status`, `/api/remote/auth/setup`, and `/api/remote/auth/login`; reject setup without the QR bootstrap token; verify Settings contains a QR/public URL but no pairing code generation action.

- [ ] **Step 2: Run red tests**

Run: `pnpm vitest run src/settings/sections/GeneralSection.source.test.ts src/remote/RemoteApp.source.test.ts`

Run: `cargo test --manifest-path src-tauri/Cargo.toml remote -- --nocapture`

Expected: failures naming the missing password endpoints and remaining pairing UI.

- [ ] **Step 3: Implement endpoints and UI flow**

The QR URL carries `#bootstrap=<secret>` so the fragment never reaches tunnel/server logs. The setup screen posts that secret with password/confirm validation, replaces browser history with the clean URL, and stores the returned session token. Status chooses setup versus login. Settings removes visible secret and rotation controls.

- [ ] **Step 4: Run green tests**

Repeat Step 2 and expect pass.

### Task 3: Protocol v2 UTF-8 output

**Files:**
- Modify: `src-tauri/src/modules/remote_protocol.rs`
- Modify: `src-tauri/src/modules/remote_protocol_test.rs`
- Modify: `src-tauri/src/modules/remote.rs`
- Modify: `src/remote/protocol.ts`
- Create: `src/remote/protocol.test.ts`

- [ ] **Step 1: Write failing protocol tests**

Assert protocol version 2 and direct string output:

```ts
expect(decodeRemoteServerEnvelope(JSON.stringify({
  version: 2,
  message: { type: "output", sessionId: 1, sequence: 2, data: "héllo" },
})).message).toMatchObject({ data: "héllo" });
```

Rust tests must prove a streaming UTF-8 decoder preserves a multibyte character split across two PTY chunks.

- [ ] **Step 2: Run red tests**

Run: `pnpm vitest run src/remote/protocol.test.ts`

Run: `cargo test --manifest-path src-tauri/Cargo.toml remote_protocol -- --nocapture`

- [ ] **Step 3: Implement protocol v2**

Replace output hex with UTF-8 strings. Keep sequence replay. Maintain a per-session streaming decoder/pending-byte buffer so chunk boundaries do not introduce replacement characters. Reject version 1 with a clear reload message.

- [ ] **Step 4: Run green tests**

Repeat Step 2 and expect pass.

### Task 4: Shared WebSocket and output batching

**Files:**
- Create: `src/remote/remoteClient.ts`
- Create: `src/remote/remoteClient.test.ts`
- Create: `src/remote/terminalOutput.ts`
- Create: `src/remote/terminalOutput.test.ts`
- Modify: `src/remote/RemoteApp.tsx`

- [ ] **Step 1: Write failing client tests**

Use a fake WebSocket factory to prove one connection serves session list and multiple session subscriptions, reconnect resumes after each session cursor, duplicate sequences are ignored, and output batches flush in order once per frame.

- [ ] **Step 2: Run red tests**

Run: `pnpm vitest run src/remote/remoteClient.test.ts src/remote/terminalOutput.test.ts`
Expected: module-not-found failure.

- [ ] **Step 3: Implement the shared client**

Expose `connect`, `subscribe(sessionId, listener)`, `listSessions`, `createSession`, `sendInput`, `resize`, and `dispose`. Keep one socket, one auth handshake, one heartbeat, one reconnect timer, and a last-sequence map.

- [ ] **Step 4: Run green tests**

Repeat Step 2 and expect pass.

### Task 5: WebGL focused terminal

**Files:**
- Create: `src/remote/RemoteTerminal.tsx`
- Create: `src/remote/RemoteTerminal.source.test.ts`
- Modify: `src/remote/RemoteApp.tsx`

- [ ] **Step 1: Write failing renderer source tests**

Require `WebglAddon`, context-loss fallback, exactly one `ResizeObserver`, changed-dimension deduplication, and no per-tile `new WebSocket`.

- [ ] **Step 2: Run red test**

Run: `pnpm vitest run src/remote/RemoteTerminal.source.test.ts`

- [ ] **Step 3: Implement renderer**

Create one terminal for the active session. Load Fit then WebGL after `open()`, dispose WebGL on context loss, batch writes, fit through one animation-frame scheduler, and send resize only when dimensions differ.

- [ ] **Step 4: Run green test**

Repeat Step 2 and expect pass.

### Task 6: clsh-style responsive UI and keyboard

**Files:**
- Create: `src/remote/RemoteKeyboard.tsx`
- Create: `src/remote/remote.css`
- Modify: `src/remote/main.tsx`
- Modify: `src/remote/RemoteApp.tsx`
- Modify: `src/remote/RemoteApp.source.test.ts`

- [ ] **Step 1: Write failing UI contracts**

Require auth/setup/login screens, folder picker, session grid, focused terminal title bar, context keys, touch keyboard, safe-area/dynamic viewport rules, and absence of `WorkspacesPanel`, `RemoteSidebar`, `TerminalTile`, and desktop breadcrumbs from the remote shell.

- [ ] **Step 2: Run red test**

Run: `pnpm vitest run src/remote/RemoteApp.source.test.ts`

- [ ] **Step 3: Implement the remote screens**

Use a small explicit screen state: auth -> picker -> sessions -> terminal. Keep the keyboard collapsed for fine-pointer/hardware-keyboard devices and visible for coarse pointers. The session grid renders metadata cards only.

- [ ] **Step 4: Run green test**

Repeat Step 2 and expect pass.

### Task 7: Full verification and documentation

**Files:**
- Modify: `docs/product/remote-access.md`
- Modify: `docs/decisions/0008-remote-pairing-workspace-boundary.md`
- Create: `docs/decisions/0009-password-remote-terminal-boundary.md`

- [ ] **Step 1: Update product and decision records**

Document the hidden QR bootstrap, password setup/login, protocol v2 migration, one-socket model, and old-token invalidation.

- [ ] **Step 2: Run frontend verification**

Run: `pnpm test -- --run`

Run: `pnpm exec tsc --noEmit`

Run: `pnpm build`

Expected: all pass without new warnings.

- [ ] **Step 3: Run Rust verification**

Run: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`

Run: `cargo test --manifest-path src-tauri/Cargo.toml --locked`

Run: `cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings`

Expected: all pass.

- [ ] **Step 4: Review scope**

Confirm only remote/settings/auth/protocol files and their documentation changed for this feature; preserve all unrelated dirty-worktree changes.
