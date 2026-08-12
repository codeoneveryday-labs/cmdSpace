# Execution Plan: Space developer vocabulary

Date: 2026-08-12

## Status

Completed

## Outcome

Space cloud transcription preserves Vietnamese speech and developer terminology
more reliably by sending a concise cmdSpace vocabulary prompt plus safe,
workspace-derived package identifiers with each supported transcription request.

## Context

`src/modules/ai/hooks/useWhisperRecording.ts` owns Space cloud uploads.
`src/modules/ai/lib/speechToText.ts` owns the selected model request contract.

## Scope

In scope:

- Add a stable bilingual developer-vocabulary prompt to supported cloud STT.
- Derive only project/dependency identifiers from safe workspace manifests.
- Verify provider-native requests preserve their vocabulary context for both
  health probes and real recordings.

Out of scope:

- Post-transcription AI rewriting and adapters beyond Deepgram Nova-3.

## Approach

1. Lock the prompt and request contract with focused tests.
2. Add a small shared request helper so health and live transcription cannot
   drift, plus a bounded manifest parser for workspace terms.
3. Add the Deepgram Nova-3 wire contract: raw audio, `Token` authorization,
   `language=multi`, response decoding, and bounded keyterms.
4. Migrate a stale staged selection to the first enabled, keyed live provider;
   label staged keys honestly and disable staged picker choices.
5. Document the behavior and run focused validation.

## Risks And Recovery

- A prompt can bias recognition incorrectly if it is too broad; keep it short,
  product-specific, and limited to technical vocabulary.
- Recovery: remove the prompt constant; no stored user data or migration is
  involved.

## Progress

- [x] Add a failing request-contract test.
- [x] Implement the shared vocabulary prompt.
- [x] Validate the focused tests and build.
- [x] Add and validate the Deepgram Nova-3 adapter.
- [x] Prevent staged providers from being presented as connected/usable.

## Decisions

- 2026-08-12: Improve recognition at the STT boundary rather than rewriting
  transcript text afterward, so users retain exactly what was spoken.

## Validation

- Focused proof: `pnpm vitest run src/modules/ai/lib/speechToText.test.ts src/modules/ai/components/FloatingVoiceAgent.source.test.ts`
- Repository-required checks: `pnpm build`, `git diff --check`

## Result

OpenAI and Groq-compatible requests keep the cmdSpace developer-vocabulary
prompt. Deepgram Nova-3 now sends raw audio with Deepgram `Token`
authorization, `language=multi`, and up to 100 technical/workspace keyterms;
it also decodes Deepgram's nested transcript response. A saved model choice for
a staged provider automatically migrates to an enabled keyed live provider;
staged providers show "Key saved · unavailable" and cannot be picked. Focused
tests passed (30 tests), `pnpm build` passed, and `git diff --check` passed.
This is context bias rather than a guarantee: acoustic quality, accents, and
provider behavior still affect individual transcriptions.
