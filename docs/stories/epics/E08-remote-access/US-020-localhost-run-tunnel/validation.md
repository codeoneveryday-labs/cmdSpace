# Validation

## Proof Strategy

Prove that output parsing rejects untrusted URLs, status preserves LAN fallback,
the SSH supervisor stops cleanly, and the frontend handles every lifecycle state
without exposing secrets.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Trusted URL parsing, punctuation, untrusted hosts, lifecycle serialization |
| Integration | Start/status/stop with tunnel unavailable; LAN fallback remains active |
| E2E | Existing remote pairing and WebSocket tests remain green |
| Platform | Rust build on the current macOS host; Windows console hiding compiles by cfg |
| Performance | Tauri commands remain non-blocking while SSH connects or retries |
| Logs/Audit | Errors exclude pairing secrets and terminal payloads |

## Fixtures

- Representative `localhost.run` output for `.localhost.run`, `.lhr.life`, and
  malformed/untrusted HTTPS URLs.
- A deterministic unavailable-SSH command path for lifecycle tests.

## Commands

```text
cd src-tauri && cargo fmt --check
cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings
cd src-tauri && cargo test
pnpm test -- --run
pnpm build
```

## Acceptance Evidence

- `cargo fmt --check` passed.
- `cargo clippy --all-targets --all-features -- -D warnings` passed.
- `cargo test --all-targets --all-features` passed: 90 Rust tests.
- `pnpm test` passed: 38 files and 171 frontend tests.
- `pnpm build` passed, including the production remote entrypoint.
- The Windows `GetAdaptersAddresses` implementation type-checked in an isolated
  `windows-sys` 0.59 crate for `x86_64-pc-windows-msvc`. A full cross-build from
  macOS remains unavailable because the host lacks the Windows C SDK/MinGW
  needed by transitive native dependencies such as `ring`.
- Final scoped review reported no actionable findings.

The documented Harness binary `scripts/bin/harness-cli` is absent in this
checkout, so durable CLI trace evidence cannot be generated until that
repository tooling is restored.
