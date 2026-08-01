# clsh-style Remote Terminal Design

Date: 2026-07-22

## Goal

Replace cmdSpace's current desktop-shell remote UI with a focused terminal client inspired by `my-claude-utils/clsh` on every browser size. The result must feel responsive on phones, remain usable on desktop browsers, and use password authentication instead of a visible pairing-code workflow.

The native cmdSpace desktop application is out of scope. Existing PTY sessions, public tunnel transport, folder selection, and session authorization remain owned by cmdSpace.

## Product flow

1. The Mac enables remote access and displays the public URL and a QR code.
2. The QR contains the public URL plus a short-lived, single-use bootstrap token. The token is never shown as a pairing code and cannot be entered manually.
3. A browser opening a fresh QR link sees `Secure your session` with password and confirm-password fields.
4. Successful setup stores only a password verifier on the Mac, consumes the bootstrap token, and returns a normal expiring remote session token.
5. Later browsers opening the public URL see a password login screen.
6. After authentication, a new browser selects a file or folder before entering the terminal UI.
7. The main remote surface opens one terminal full screen. A grid button opens the session switcher; settings and connection state stay secondary.

There is no user-facing pairing-code screen, pairing-code field, pairing-code rotation action, or pairing-code label in Settings.

## Security model

The first password setup cannot be unauthenticated: otherwise the first internet visitor to discover the tunnel URL could claim the server. A hidden bootstrap token in the QR therefore remains as an implementation detail. It is single-use, expires quickly, is rate-limited, and is removed from browser history after exchange.

Passwords must not be stored or compared as plain SHA-256. The server stores a salted, memory-hard password verifier and compares derived keys in constant time. Existing per-IP authentication throttling remains, with a stricter password-login window. Successful setup/login issues the existing signed session-token shape, so HTTP and WebSocket authorization continue to share one mechanism.

When remote access is reset, the password verifier and active remote sessions are revoked together. Merely restarting the UI must not silently remove the password.

## Terminal architecture

### Shared transport

Create one remote WebSocket client for the browser. It owns authentication, reconnect backoff, heartbeat, session listing, subscriptions, input, and resize messages. Terminal views subscribe through a small in-memory message bus keyed by session ID.

This replaces the current `N terminal sockets + 1 control socket` model and prevents duplicated handshakes, reconnect timers, and session polling.

### Output protocol

Stop hex-encoding PTY output. Send UTF-8 terminal output directly in protocol messages, preserving sequence numbers for replay and reconnect. The client queues output by session and flushes writes once per animation frame, with an immediate flush threshold for large bursts. This removes the 2x hex payload expansion and avoids a React/browser task per small PTY chunk.

Protocol versioning must reject incompatible old clients clearly rather than silently decoding the wrong format.

### Renderer

Each mounted terminal uses xterm.js with the existing Fit addon and WebGL addon already present in cmdSpace dependencies. WebGL context loss disposes the addon and falls back to the default renderer without destroying the session.

Only the active terminal is mounted in the full-screen view. The session grid uses metadata and lightweight previews, not live xterm instances. Scrollback remains bounded. Touch scrolling uses xterm line scrolling with requestAnimationFrame momentum rather than direct viewport `scrollTop` mutation.

### Resize control

A single ResizeObserver schedules `fit()` on the next animation frame. PTY resize is emitted only when rows or columns actually changed and is debounced to avoid keyboard/viewport resize storms. The duplicate window resize and terminal resize feedback paths are removed.

## Interface

The authenticated interface follows the compact clsh hierarchy on both mobile and desktop browsers:

- 44px title bar with traffic lights, editable session title, session-grid button, and settings button.
- Terminal fills all remaining available height.
- Horizontally scrollable context strip for Esc, function keys, Ctrl-C, and configurable command shortcuts.
- On touch-first devices, an optional terminal keyboard with letters, numbers, modifiers, arrows, Tab, Escape, and Return.
- On hardware-keyboard devices, the custom keyboard starts collapsed and the terminal receives native key input.
- The session grid is a separate lightweight screen with create, rename, open, and close actions.
- Connection/reconnect state is visible but does not cover terminal content.
- Safe-area insets, dynamic viewport height, and minimum 44px touch targets are respected.

The former workspace sidebar, helper sidebar, desktop tab strip, footer breadcrumbs, multi-terminal live grid, and decorative git counters are removed from the remote bundle.

## State and recovery

The shared client retains the last received sequence per session. On reconnect it reauthenticates once, resubscribes to the active session, requests output after the last sequence, and refreshes session metadata. Duplicate sequence numbers are ignored.

If a saved session token expires, the UI returns to password login without deleting the chosen folder. A password reset or remote-access reset clears both authentication and remembered folder state.

## Alternatives considered

### Keep the current remote shell and only add WebGL

Rejected because it improves rendering but leaves multiple sockets, live terminal grids, resize storms, and poor mobile information hierarchy intact.

### Copy the entire clsh Node agent and web application

Rejected because cmdSpace already owns PTYs, desktop sessions, Tauri lifecycle, tunnel state, and authorization. Running a second Node agent would duplicate process/session ownership and make the native app harder to recover and ship.

### Adopt clsh interaction patterns over cmdSpace's backend

Selected. It captures the renderer, transport, keyboard, and full-screen terminal strengths while preserving cmdSpace's existing native session model.

## Verification

Implementation is complete only when:

- No pairing-code text, input, or rotation action remains in remote or Settings UI.
- First QR visit can set and confirm a password; a direct unbootstrapped visitor cannot claim password setup.
- Subsequent fresh browsers authenticate with the password.
- Wrong-password attempts are rate-limited and do not disclose whether setup exists beyond the intended status endpoint.
- One browser creates exactly one terminal WebSocket regardless of session count.
- Reconnect replay produces no duplicate terminal output.
- Output protocol no longer uses hex and protocol tests cover incompatible versions.
- WebGL is active when supported and fallback survives simulated context loss.
- Resize messages are deduplicated and bounded during viewport/keyboard changes.
- Session grid does not mount live xterm renderers.
- Mobile and desktop screenshots match the same clsh-style hierarchy.
- Frontend tests, Rust tests, typecheck, production build, and Clippy pass.

## Known risks

- Password hashing requires a memory-hard implementation; using a new Rust dependency needs explicit approval under repository rules unless an acceptable implementation already exists transitively.
- Direct UTF-8 strings must preserve split multibyte output across PTY chunks; the server or client needs a streaming decoder rather than lossy per-chunk conversion.
- WebGL contexts are limited on mobile, reinforcing the single-mounted-terminal requirement.
- Existing browsers carrying pairing-issued tokens need a deliberate migration policy; the safest default is to invalidate them when password auth ships.
