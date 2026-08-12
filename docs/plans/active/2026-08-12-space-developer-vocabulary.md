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
- Verify multipart requests preserve the prompt for both health probes and real
  recordings.

Out of scope:

- New provider adapters, automatic language selection, or post-transcription
  AI rewriting.

## Approach

1. Lock the prompt and request contract with focused tests.
2. Add a small shared request helper so health and live transcription cannot
   drift, plus a bounded manifest parser for workspace terms.
3. Document the behavior and run focused validation.

## Risks And Recovery

- A prompt can bias recognition incorrectly if it is too broad; keep it short,
  product-specific, and limited to technical vocabulary.
- Recovery: remove the prompt constant; no stored user data or migration is
  involved.

## Progress

- [x] Add a failing request-contract test.
- [x] Implement the shared vocabulary prompt.
- [x] Validate the focused tests and build.

## Decisions

- 2026-08-12: Improve recognition at the STT boundary rather than rewriting
  transcript text afterward, so users retain exactly what was spoken.

## Validation

- Focused proof: `pnpm vitest run src/modules/ai/lib/speechToText.test.ts src/modules/ai/components/FloatingVoiceAgent.source.test.ts`
- Repository-required checks: `pnpm build`, `git diff --check`

## Result

Cloud STT payloads now carry the cmdSpace developer vocabulary plus safe,
bounded terms extracted from the active workspace's `package.json`,
`Cargo.toml`, `go.mod`, and `pyproject.toml` for OpenAI and Groq-compatible
multipart requests. Focused tests passed (30 tests), `pnpm build` passed, and
`git diff --check` passed. This is context bias rather than a guarantee:
acoustic quality, accents, and provider behavior still affect individual
transcriptions.
