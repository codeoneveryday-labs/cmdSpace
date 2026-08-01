# Validation

## Acceptance Criteria

- The public URL is rendered as a QR only when available.
- The QR value excludes the one-time pairing secret.
- Remote file/folder listing is inaccessible without bearer authentication.
- Folder selection opens that folder; file selection opens its parent folder.
- No file contents are returned.
- Existing terminal WebSocket and tunnel behavior remains green.

## Commands

```text
cd src-tauri && cargo fmt --check
cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings
cd src-tauri && cargo test --all-targets --all-features
pnpm test
pnpm build
```

## Acceptance Evidence

- `cargo fmt --check`: passed.
- `cargo clippy --all-targets --all-features -- -D warnings`: passed.
- `cargo test --all-targets --all-features`: 93 passed.
- `pnpm test`: 173 passed.
- `pnpm build`: passed (`tsc && vite build`).
- Mobile pairing screen visual verdict: pass, 93/100, at 390 x 844.
- Regression coverage rejects bare provider documentation URLs and forces a
  fresh file/folder choice after each new pairing.
- Regression coverage keeps the first unused code available after auto-start,
  supports explicit code rotation, and cancels stale picker navigation.
- Independent code review findings were addressed before final verification.
