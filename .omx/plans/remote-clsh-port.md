# Remote terminal inspired by clsh

## Requirements Summary

Build cmdSpace remote access with the same product behavior as `clsh`: open a real Mac terminal from a phone, stream terminal input/output in real time, support multiple sessions, preserve sessions when possible, and expose the service through a public tunnel.

The implementation must extend the existing Tauri/Rust architecture rather than embed a second Node.js agent. Keep `portable-pty`, `PtyState`, cmdSpace workspace authorization, and the existing React remote surface. The current remote server is LAN-only HTTP + SSE/POST; it must become a secure, tunnel-capable HTTPS/WSS endpoint.

## Scope

Included:

- WebSocket transport for bidirectional terminal traffic.
- Authentication bootstrap flow and authenticated sessions.
- Tunnel abstraction with LAN fallback and `localhost.run` SSH reverse tunnel first.
- Optional ngrok adapter only after the SSH path is stable.
- Multiple remote sessions and attach/detach behavior.
- Mobile terminal UX based on clsh's session grid and custom keyboard ideas.
- tmux-backed persistence where available, with graceful fallback.
- Unit, integration, security, and manual mobile verification.

Excluded from the first slice:

- Replacing the native PTY backend with `node-pty`.
- Cloning clsh's landing page, CLI, or monorepo structure.
- Team sharing, cloud machines, native iOS/Android apps, and public hosted infrastructure.

## Design Decision

Use a Rust `RemoteGateway` inside cmdSpace:

```text
Phone browser
    -> HTTPS/WSS tunnel URL
    -> Rust RemoteGateway
       -> auth/session protocol
       -> existing PtyState / portable-pty
       -> zsh/bash -> Claude Code/tmux
```

Expose tunnel providers behind one interface:

```text
TunnelProvider
  - LanProvider
  - LocalhostRunSshProvider
  - NgrokProvider (follow-up)
```

The browser uses one WebSocket per active terminal session. HTTP remains for bootstrap/configuration and static assets; terminal input, output, resize, attach, detach, and exit events use WebSocket messages.

## Acceptance Criteria

1. A phone on the same LAN can open the displayed URL and connect to a real zsh/bash PTY.
2. A phone outside the LAN can connect through `localhost.run` without exposing an unauthenticated raw port.
3. The first connection requires a single-use bootstrap credential that expires after a short TTL; subsequent connections use a signed session token.
4. No credential is sent in a URL query string; WebSocket authentication is performed as the first message after upgrade.
5. Terminal input, output, resize, session attach/detach, and exit are all handled over WebSocket with reconnect-safe sequencing.
6. A dropped phone connection does not kill the Mac session; reconnect can recover the current terminal snapshot and continue streaming.
7. Remote-created sessions are isolated from desktop PTY dimensions; attaching an existing desktop PTY does not permanently change its local size.
8. Working directories remain restricted to the user home or authorized launch workspace.
9. Invalid Origin, expired token, oversized payload, invalid terminal dimensions, and unauthenticated commands are rejected.
10. tmux persistence survives agent restart when tmux is installed; without tmux, the UI clearly treats sessions as ephemeral.
11. Remote UI supports at least two simultaneous sessions, mobile safe-area layout, terminal scrolling, custom modifier keys, and reconnect/offline state.
12. Existing local terminal, AI, workspace, and editor behavior remains unchanged.

## Implementation Steps

### Current progress (2026-07-21)

- Complete: versioned Rust/TypeScript remote protocol.
- Complete: authenticated WebSocket gateway for list/create/attach/detach/input/resize/close and reconnect sequencing.
- Complete: one-time pairing code, signed session token, Origin validation, and auth rate limiting.
- Complete: Remote UI pairing screen, authenticated metadata requests, WebSocket terminal streaming, replay cursor, and reconnect backoff.
- Complete: legacy terminal HTTP/SSE routes retired with `410 Gone`; remote and desktop PTY id ranges no longer overlap.
- Pending: listener boundary cleanup, `localhost.run` tunnel provider/lifecycle, tunnel status UI, mobile modifier keyboard, and optional tmux persistence.

### 1. Freeze the current contract and map protocol boundaries

Files to inspect and preserve:

- `src-tauri/src/modules/pty/mod.rs` — session ownership, output subscription, resize ownership.
- `src-tauri/src/modules/pty/session.rs` — reader/writer and replay behavior.
- `src-tauri/src/modules/remote.rs` — current HTTP routes, folder authorization, runtime sessions.
- `src/remote/RemoteApp.tsx` — current mobile UI and EventSource/POST transport.
- `src/settings/sections/GeneralSection.tsx` and `src/modules/settings/remoteAccess.ts` — lifecycle and settings contract.

Add protocol types and tests before replacing transport so the current LAN implementation remains a fallback during migration.

### 2. Introduce a typed WebSocket protocol

Create a small protocol module on the Rust side and matching TypeScript types on the remote side.

Messages should include `hello/auth`, `session.list`, `session.create`, `session.attach`, `session.detach`, `input`, `resize`, `snapshot`, `output`, `exit`, and `error`.

Requirements:

- explicit message version;
- session id on every session-scoped message;
- monotonically increasing output sequence;
- bounded input/output frame size;
- bounded `cols` and `rows`;
- no arbitrary command execution outside the PTY itself.

### 3. Add authentication before public tunneling

Implement:

- random bootstrap secret generated at remote start;
- hash-only server storage;
- one-time use and five-minute expiry;
- signed session token with issuer, expiry, and session id/device claims;
- first WebSocket frame authentication;
- constant-time token comparison;
- Origin validation and auth rate limiting.

Do not expose a public tunnel until this step passes security tests.

### 4. Refactor the listener into a remote gateway

Replace the hand-written route branching in `src-tauri/src/modules/remote.rs` with separate boundaries for:

- static asset serving;
- bootstrap/auth endpoints;
- session REST metadata;
- WebSocket upgrade and frame handling;
- folder/workspace authorization.

Keep the current `PtyState` integration and `authorize_remote_cwd` rules. Preserve a LAN HTTP health endpoint for diagnostics, but make terminal traffic WebSocket-only.

### 5. Add tunnel providers

Implement in this order:

1. Existing LAN URL provider, retained as the no-dependency fallback.
2. `localhost.run` SSH reverse tunnel using a child process with captured stdout/stderr, exit detection, shutdown, and restart handling.
3. Optional ngrok provider behind configuration, only after the SSH provider is reliable.

The tunnel lifecycle must report `starting`, `ready`, `degraded`, `stopped`, and `error`, with the public URL only marked ready after a health check succeeds.

### 6. Migrate the remote frontend

Update `src/remote/RemoteApp.tsx` and `src/remote/remote.css` to:

- consume the typed WebSocket protocol;
- show bootstrap/login state;
- reconnect with backoff;
- restore snapshot before live output;
- keep multiple sessions alive;
- add clsh-inspired mobile keyboard behavior without copying branding/assets;
- show tunnel status and a copyable public URL.

Keep the current workspace/folder picker behavior unless it conflicts with authentication or session attach.

### 7. Add persistence and lifecycle hardening

Add tmux-backed session restoration only after WebSocket/session behavior is stable. Reuse existing shell initialization and workspace environment logic. Ensure shutdown closes tunnel processes and sockets without killing detached persistent sessions.

### 8. Verification and release hardening

Run:

- frontend type-check and existing Vitest suite;
- `cargo fmt --check`, `cargo clippy`, and Rust tests;
- protocol unit tests for parsing, sequencing, limits, and auth expiry;
- gateway integration tests using loopback sockets;
- tunnel smoke test with a controllable local SSH/mock provider;
- manual same-LAN phone test;
- manual external tunnel test;
- reconnect, simultaneous sessions, resize, tmux restart, and invalid-auth tests.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Public terminal becomes unauthenticated RCE | Auth is implemented and tested before tunnel exposure; deny-by-default routes. |
| WebSocket reconnect loses output | Sequence numbers plus snapshot/replay cursor. |
| Tunnel child process hangs or leaks | Dedicated lifecycle owner, kill-on-stop, health checks, timeout, stderr capture. |
| Remote resize disrupts desktop terminal | Separate remote PTYs or restore desktop-owned dimensions. |
| tmux behavior differs from native PTY | Treat tmux as an optional persistence adapter and keep a non-tmux path. |
| Large clsh copy creates duplicated architecture | Port protocol/UX/security concepts; keep Rust PTY and Tauri shell. |
| Dirty worktree contains unrelated user changes | Do not reset or overwrite existing changes; isolate edits to remote-specific files. |

## Follow-up Decisions

- Whether the public URL should be temporary per start or a persistent ngrok domain.
- Whether remote access should be enabled by default or only after explicit settings activation.
- Whether the first release should include attaching existing desktop PTYs or only create isolated remote sessions.
- Whether tmux persistence is required for the first usable release or can follow the secure WebSocket/tunnel slice.

## Evidence Base

- clsh architecture and transport: <https://github.com/my-claude-utils/clsh#how-it-works>
- clsh security model: <https://github.com/my-claude-utils/clsh#security>
- clsh tunnel fallback: <https://github.com/my-claude-utils/clsh#tunnel-setup>
- clsh agent source layout: <https://github.com/my-claude-utils/clsh/tree/main/packages/agent/src>
- clsh web source layout: <https://github.com/my-claude-utils/clsh/tree/main/packages/web/src>
