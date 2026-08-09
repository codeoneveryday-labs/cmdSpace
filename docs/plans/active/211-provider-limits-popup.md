# Provider limits popup

Issue: #211

## Outcome

Add an accessible Usage control beside Shortcuts. Its popup shows only provider quota/rate-limit snapshots reported by local CLI session logs. Existing per-session terminal usage remains unchanged.

## Plan

1. Add a native provider-limit DTO and command that reuses local Codex/Claude parsers without network calls or credential access.
2. Add a header popover with loading, refresh, provider cards, and an explicit unavailable state.
3. Add focused Rust and frontend tests, then run typecheck/build and Cargo checks.

## Validation

- `pnpm test` — 91 files, 496 tests passed.
- `pnpm build` — TypeScript and Vite production build passed.
- `cargo check --all-targets --locked` and Clippy with warnings denied — passed.

## Constraints

- No external API requests or credential scraping.
- Provider limits are snapshots; they are not a cost dashboard or a replacement for terminal session usage.
