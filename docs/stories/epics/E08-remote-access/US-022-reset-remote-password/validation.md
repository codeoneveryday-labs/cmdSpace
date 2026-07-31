# Validation

## Proof Strategy

Prove old passwords/tokens fail, replacement setup succeeds, the local command
is registered, and Settings requires confirmation.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Reset rotates auth material and accepts a replacement password |
| Integration | Tauri command and Settings source contracts are registered |
| E2E | Not requested |
| Platform | TypeScript compile and Rust format |
| Performance | Not applicable |
| Logs/Audit | Reset log contains no credential material |

## Fixtures

Deterministic in-memory auth material and generated replacement credentials.

## Commands

```text
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml remote_auth_test
pnpm vitest run src/settings/sections/GeneralSection.source.test.ts
pnpm exec tsc --noEmit
```

## Acceptance Evidence

- Rust auth tests: 4 passed.
- Settings source tests: 8 passed.
- Rust format check: passed.
- TypeScript compile: passed.
- Manual QA intentionally omitted at user request.
