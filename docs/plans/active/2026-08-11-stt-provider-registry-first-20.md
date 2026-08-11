# STT Provider Registry First-20

Date: 2026-08-11

## Status

Complete

## Outcome

The voice settings surface now shows the first 20 cloud STT providers from the
requested table, plus the existing NVIDIA NIM entry already supported by the
app. Each provider has a keycard, an icon mapping, and a speech-to-text model
record in the shared registry.

Providers that still need transport work are marked `developmentOnly` and fall
back to native speech instead of attempting a broken cloud request.

## Context

- `src/modules/ai/config.ts` is now the source of truth for provider labels,
  keyring accounts, console links, icons, and speech-to-text model metadata.
- `src/modules/ai/lib/speechToText.ts` derives the model catalog from that
  registry, so Settings and runtime stay in sync.
- `src/settings/sections/ModelsSection.tsx` now explains staged providers
  explicitly instead of hardcoding old provider names.

## Validation

- Focused Vitest:
  - `src/modules/ai/lib/speechToText.test.ts`
  - `src/modules/ai/config.source.test.ts`
  - `src/settings/sections/ModelsSection.source.test.ts`
  - `src/modules/ai/components/FloatingVoiceAgent.source.test.ts`
  - `src/components/brandIcons.test.ts`
- Repository build: `pnpm build`

## Notes

- This slice is registry-first. Full transport adapters for the staged
  providers remain a separate follow-up.
