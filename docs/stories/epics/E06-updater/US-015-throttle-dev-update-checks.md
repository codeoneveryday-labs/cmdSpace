# US-015 Throttle Dev Update Checks

## Status

implemented

## Lane

normal

## Product Contract

The updater should not spam logs during development or when the update endpoint
temporarily fails. Packaged app sessions can still check automatically, and
manual checks remain available from Settings.

## Relevant Product Docs

- `docs/product/updater.md`

## Acceptance Criteria

- Development builds skip automatic updater checks.
- Failed automatic checks update the last-check timestamp so retries are
  throttled.
- Manual update checks remain available and are not blocked by the automatic
  throttle.
- Successful no-update checks keep the existing throttle behavior.

## Design Notes

- Commands: unchanged.
- Queries: updater endpoint checks.
- API: unchanged.
- Tables: unchanged.
- Domain rules: `import.meta.env.DEV` disables automatic checks only; manual
  checks still call the updater.
- UI surfaces: updater dialog and Settings About update check.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Updater source regression test |
| Integration | Typecheck and full Vitest suite |
| E2E | Not required for this narrow updater hook behavior |
| Platform | Not run; manual dev log smoke remains useful |
| Release | Manual packaged update check smoke |

## Harness Delta

None.

## Evidence

2026-07-04:
- `./node_modules/.bin/vitest run src/modules/updater/useUpdater.source.test.ts`
  passed with 1 test.
- `./node_modules/.bin/tsc --noEmit` passed.
- `./node_modules/.bin/vitest run` passed with 26 files and 128 tests.
