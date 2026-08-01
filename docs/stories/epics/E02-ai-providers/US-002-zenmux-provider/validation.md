# Validation

## Proof Strategy

Use source-level regression tests to ensure ZenMux is wired across the catalog,
keyring defaults, icon maps, and language model construction. Then run typecheck
and the full frontend test suite.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Source test verifies provider/model/keyring/agent/icon registration |
| Integration | `pnpm exec tsc --noEmit` validates provider exhaustiveness |
| E2E | Not required for the initial provider catalog addition |
| Platform | Not required; no Tauri command or capability changes |
| Performance | Not applicable |
| Logs/Audit | Not applicable |

## Fixtures

No live ZenMux key is required. The test locks static configuration only.

## Commands

```text
pnpm test -- src/modules/ai/config.source.test.ts
pnpm exec tsc --noEmit
pnpm test
scripts/bin/harness-cli story verify US-002
```

## Acceptance Evidence

- RED: `pnpm test -- src/modules/ai/config.source.test.ts` failed before
  implementation because ZenMux was absent from provider config.
- `pnpm test -- src/modules/ai/config.source.test.ts`
- `pnpm exec tsc --noEmit`
- `pnpm test`
