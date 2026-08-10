# Provider limits popup

Issue: #211

## Outcome

Add an accessible Usage control beside Shortcuts. Its popup shows provider quota/rate-limit snapshots and, for Command Code, the signed-in account metrics exposed by `/usage`. Existing per-session terminal usage remains unchanged.

## Plan

1. Add a native provider-limit DTO and command that reuses local Codex/Claude parsers and reads Command Code's `/usage` account metrics.
2. Add a header popover with loading, refresh, provider cards, and an explicit unavailable state.
3. Add focused Rust and frontend tests, then run typecheck/build and Cargo checks.

## Progressive loading

- Add a provider-scoped native command so the popover can request enabled providers concurrently instead of waiting for one aggregate response.
- Track pending provider IDs in the popover. A card without cached data renders a fixed-height skeleton until its own request settles; resolved cards render immediately.
- Refresh preserves existing card data while requests run. Unsupported or unavailable providers transition from skeleton to the existing unavailable message.
- Keep the aggregate command for tray usage and existing consumers.

## Validation

- `pnpm test` — 91 files, 496 tests passed.
- `pnpm build` — TypeScript and Vite production build passed.
- `cargo check --all-targets --locked` and Clippy with warnings denied — passed.

## Constraints

- Command Code account requests mirror its `/usage` flow and send its existing API key only to `https://api.commandcode.ai`; credentials are never returned to the frontend.
- Provider limits are snapshots; they are not a cost dashboard or a replacement for terminal session usage.
