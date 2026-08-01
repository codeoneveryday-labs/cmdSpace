# US-014 Session Keychain Cache

## Status

implemented

## Lane

normal

## Product Contract

AI provider keys remain stored in the OS keychain, but cmdSpace caches keys in
memory after a successful read or write during the current app session. This
reduces repeated macOS keychain prompts while preserving keychain persistence as
the source of truth.

## Relevant Product Docs

- `docs/product/ai-providers.md`

## Acceptance Criteria

- Keychain reads populate an in-memory secret cache.
- Keychain writes update the in-memory secret cache.
- Key deletion removes the cached value.
- Batch key reads reuse cached values before calling the OS keychain.
- Secrets are not persisted outside the existing OS keychain or Linux local
  secrets file backend.

## Design Notes

- Commands: `secrets_get`, `secrets_set`, `secrets_delete`, `secrets_get_all`.
- Queries: provider key loading.
- API: unchanged Tauri command names and payloads.
- Tables: unchanged.
- Domain rules: cache is process-local only; app restart still reads from the
  OS secret backend.
- UI surfaces: macOS Keychain prompt behavior.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | AI provider source regression test and Rust tests |
| Integration | Typecheck, full Vitest suite, cargo test, Clippy |
| E2E | Not required for this narrow secret backend behavior |
| Platform | Not run; manual macOS Keychain prompt smoke remains useful |
| Release | Manual provider key read after one `Always Allow` approval |

## Harness Delta

None.

## Evidence

2026-07-04:
- `./node_modules/.bin/vitest run src/modules/ai/config.source.test.ts` passed
  with 1 test.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 25 files and 127 tests.
- `cargo test` passed with 56 Rust tests.
- `cargo clippy --all-targets --all-features --locked -- -D warnings` passed.
