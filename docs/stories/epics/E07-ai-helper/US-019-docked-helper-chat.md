# US-019 Docked Helper Chat

## Status

implemented

## Lane

normal

## Product Contract

The right sidebar Helper tab mounts the existing AI chatbot as a docked chat
surface instead of a static placeholder. It reuses the active AI session,
composer, provider connection state, and terminal-aware chat transport already
used by Cmd+I.

## Relevant Product Docs

- `docs/product/ai-helper.md`
- `docs/product/ai-providers.md`
- `docs/product/shell-overlays.md`

## Acceptance Criteria

- The Helper sidebar tab renders a real AI chat body for the active session.
- The Helper sidebar tab includes an input or provider-connect control at the
  bottom, matching the existing AI availability rules.
- Sending from the Helper sidebar keeps the response in the Helper sidebar and
  does not auto-open the mini popup chat.
- The empty Helper sidebar presents compact quick prompts for common terminal
  tasks.
- The Helper composer has a visible send button and framed input treatment.
- The Helper sidebar tab keeps using the shared `chatStore`/composer stack, so
  Cmd+I and Helper do not maintain separate chat sessions.
- The previous centered static "Helper" placeholder is removed.

## Design Notes

- Commands: none.
- Queries: reads the active chat session from `useChatStore`.
- API: no new public API or Tauri command.
- Tables: none.
- Domain rules: Helper is a second view over the existing AI session, not a new
  assistant state model.
- UI surfaces: right sidebar Helper tab, AI chat view, AI input bar, provider
  connection affordance.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-019 --unit 1 --integration 0 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | `pnpm test src/app/App.test.ts` checks App wiring for `AiSidebarHelper`. |
| Integration | `pnpm exec tsc --noEmit` checks the React/TypeScript graph. |
| E2E | Not run for this first slice; no browser automation harness is configured. |
| Platform | Not required; no Tauri command or native webview behavior changed. |
| Release | `pnpm test` passed for the frontend suite. |

## Harness Delta

The required Harness CLI path from AGENTS.md (`scripts/bin/harness-cli`) is
missing in this checkout, so durable story and trace rows could not be recorded
with the CLI. The story file carries the validation evidence for now.

## Evidence

- `pnpm test src/app/App.test.ts` passed: 13 tests.
- `pnpm exec tsc --noEmit` passed.
- `pnpm test` passed: 28 files, 137 tests.
