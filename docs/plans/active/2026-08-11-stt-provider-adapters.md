# Realtime STT Provider Adapters

Date: 2026-08-11

## Status

Active

## Outcome

The floating voice control streams microphone audio to selected cloud realtime
STT providers and inserts only a final transcript into the active terminal.
Native speech remains the no-key and failure fallback. Local/offline endpoints
are explicitly out of scope.

## Context

- `src/modules/ai/hooks/useWhisperRecording.ts` currently records a complete
  `MediaRecorder` blob and uses a synchronous, OpenAI-compatible HTTP request.
- Realtime providers require bidirectional sessions, PCM audio frames, and
  provider-specific partial/final message parsing.
- The first 20-provider expansion is deferred: the user changed priority to
  realtime services first.
- Research: `docs/reports/stt-provider-research-1-5.md` and
  `docs/reports/stt-provider-research-11-15.md`.

## Scope

In scope:

- A Tauri-owned, SSRF-safe realtime WebSocket bridge; the renderer never opens
  provider sockets or receives a key in a WebSocket URL.
- A shared PCM16 microphone stream and provider adapter contract.
- The documented WebSocket providers that fit the bridge: OpenAI Realtime,
  Deepgram, AssemblyAI, Speechmatics, Inworld, Rev AI, Gladia, and Soniox.
- Settings cards, model selection, and clear connection requirements/icons for
  those providers.
- Partial transcripts in the voice status and final-only terminal insertion.

Out of scope:

- Local/offline STT, file/batch-only providers, or pretending gRPC-only
  providers (Google Cloud, Nuance) are supported by the WebSocket bridge.
- Credentials that need a separately managed cloud identity or account setup
  (AWS, Azure) until their setup UX and native adapter are designed.
- Chat, text generation, and persistence of microphone audio or transcripts.

## Approach

1. Add a typed realtime catalog with capability, auth, and transcript-event
   contracts. Keep file-transcription models separate so selection cannot route
   a realtime model through a one-shot upload.
2. Add tests for provider metadata, frame lifecycle, and partial/final parsing.
3. Implement a native WebSocket session manager and a frontend bridge using
   binary PCM16 frames plus named lifecycle events.
4. Implement adapters in two independently testable groups: direct WebSocket
   protocols (Deepgram, AssemblyAI, Speechmatics, Inworld, Rev, Soniox), then
   session-minting/realtime protocols (OpenAI, Gladia).
5. Replace blob upload capture for selected realtime models with PCM streaming;
   keep existing native fallback on unavailable key, browser capture failure,
   provider error, and session teardown.
6. Add the settings UI/icons without adding dependencies, then run focused
   Vitest, `pnpm build`, and native checks.

## Risks And Recovery

- Different providers have incompatible auth/session-opening protocols. Keep
  the provider parser/encoder isolated and expose only the common lifecycle to
  the voice hook.
- A stuck realtime session can continue provider billing. Stop/error/unmount
  must close the native session exactly once.
- Browser microphone audio format differs from provider wire formats. Stream
  tested PCM16 mono chunks instead of MediaRecorder WebM blobs.
- Recovery: a bad selected realtime model falls back to native speech; no key,
  preference, or captured audio is deleted.

## Progress

- [x] Research documented realtime transport and auth contracts.
- [x] Define the initial catalog and partial/final parser contract with focused tests.
- [ ] Add the native WebSocket session manager and Tauri command registration.
- [ ] Add the frontend PCM capture/session bridge and native fallback.
- [ ] Add settings models, provider cards, and icons.
- [ ] Run focused, build, and native validation.

## Decisions

- 2026-08-11: Prioritize cloud realtime STT before the broader 20-provider
  batch, per user direction.
- 2026-08-11: Exclude local/offline endpoints; retain native OS recognition as
  fallback only.
- 2026-08-11: Do not label providers requiring gRPC or unimplemented account
  credential flows as WebSocket-realtime supported.

## Validation

- Focused proof: catalog/parser/encoder tests; microphone frame/session
  lifecycle tests; native session-manager unit tests.
- Integration proof: a mocked provider socket verifies partial display, final
  insertion, and teardown/fallback paths.
- Repository-required checks: focused Vitest, `pnpm build`, and
  `cd src-tauri && cargo check --all-targets --locked`.

## Result

Complete after implementation. Record the verified outcome, limitations, and
follow-up before moving the plan to `docs/plans/completed/`.
