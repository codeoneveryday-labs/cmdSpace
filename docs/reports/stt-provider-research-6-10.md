# STT Provider Research 6–10 — realtime-first

Date: 2026-08-11

Scope: ElevenLabs, Amazon Transcribe, Azure Speech, Gladia, Soniox. This note prioritizes the realtime API shape first, then calls out the closest sync/async fallback when the realtime path is not directly usable from the current Tauri app.

## Quick matrix

| Provider | Realtime transport | Auth | Request encoding | Response text path | Current app feasibility |
| --- | --- | --- | --- | --- | --- |
| ElevenLabs | WSS `wss://api.elevenlabs.io/v1/speech-to-text/realtime` | `xi-api-key` header or `token` query param | JSON messages with base64 audio chunks; `commit` supports manual finalization | `partial_transcript.text`, `final_transcript.text`, `committed_transcript.text` | Feasible with a browser WS flow if it uses the documented token path; raw header auth is not browser-WebSocket friendly |
| Amazon Transcribe | HTTP/2 or WSS `StartStreamTranscription`; presigned WS URL | AWS Signature Version 4 | Event stream encoding with raw audio frames; `media-encoding` and `sample-rate` required | `Transcript.Results[0].Alternatives[0].Transcript` | Not directly feasible with the current HTTP-only proxy; needs SigV4 + streaming bridge |
| Azure Speech | Speech SDK real-time; REST short-audio `.../speech/recognition/conversation/cognitiveservices/v1` | Speech resource key / auth token; `Ocp-Apim-Subscription-Key` for REST token minting | SDK streams audio; short-audio REST sends raw audio bytes | `DisplayText` for simple REST; `Display` for detailed REST | REST short-audio is feasible; SDK realtime is not directly feasible without SDK or a bridge |
| Gladia | WSS session after `POST https://api.gladia.io/v2/live` | `x-gladia-key` on init; returned WSS URL contains a temporary token | Init JSON body (`encoding`, `bit_depth`, `sample_rate`, `channels`, `model`, `endpointing`, etc.); audio sent as binary or base64 WS chunks | `Transcript`, `Post Transcript`, `Final transcript (aggregated)` WS events; pre-recorded result `result.text` | Feasible with current app primitives; init/result are HTTP and the live socket uses a temporary token URL |
| Soniox | WSS `wss://stt-rt.soniox.com` | `Authorization: Bearer <SONIOX_API_KEY>`; temporary API keys are also documented for client-side use | Binary WebSocket audio frames; empty frame ends stream | Realtime `tokens[].text`; async transcript endpoint `text` | Async REST is feasible; realtime WS is not directly feasible without a token bridge or WS client support |

## ElevenLabs

- Realtime transport: `wss://api.elevenlabs.io/v1/speech-to-text/realtime`.
- Auth: the docs accept either `xi-api-key` in the handshake or a `token` query parameter. The token path is the browser-friendly option because browser WebSocket APIs cannot set custom headers.
- Request shape: the session is created with a `config` message; audio is sent as `input_audio_chunk` messages containing `audio_base_64`. The docs show `partial_transcript`, `final_transcript`, and `committed_transcript` messages coming back.
- Response text path: `text` on the transcript messages.
- Other useful knobs: `model_id` is required; the docs list `audio_format`, `language_code`, and `secondary_languages`.
- Sync/async fallback: `POST /v1/speech-to-text/transcripts` accepts multipart form upload and can run synchronously or asynchronously via webhook. The response uses `text` for the single transcript and `transcripts[].text` for multichannel output.
- Official docs:
  - https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
  - https://elevenlabs.io/docs/api-reference/speech-to-text/convert
  - https://elevenlabs.io/docs/api-reference/speech-to-text/get

## Amazon Transcribe

- Realtime transport: the streaming API supports bidirectional HTTP/2 and WebSocket sessions.
- Auth: both HTTP and WebSocket requests must be signed with AWS Signature Version 4. For WebSocket streaming, AWS uses a presigned URL with the SigV4 query parameters.
- Request shape: streaming requests require `language-code` or language identification plus `media-encoding` and `sample-rate`. Audio frames use Amazon event stream encoding.
- Response text path: `Transcript.Results[0].Alternatives[0].Transcript`.
- Other useful knobs: channel identification, partial result stabilization, vocabulary filters, and PII redaction/identification.
- Current app assessment: the existing app has an HTTP proxy, but not a general SigV4 streaming bridge. That makes Amazon Transcribe realtime a backend/transport project, not a small renderer-only integration.
- Official docs:
  - https://docs.aws.amazon.com/transcribe/latest/dg/getting-started-http-websocket.html
  - https://docs.aws.amazon.com/transcribe/latest/dg/streaming-setting-up.html
  - https://docs.aws.amazon.com/transcribe/latest/APIReference/API_streaming_StartStreamTranscription.html

## Azure Speech

- Realtime transport: Azure’s public guidance centers on the Speech SDK for real-time STT. The docs describe the SDK as suitable for real-time and non-real-time scenarios.
- Sync/async fallback: the short-audio REST endpoint is `POST https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=<locale>`. The REST API also has a newer batch/fast transcription surface, but the short-audio endpoint is the clearest sync path in the public docs.
- Auth: REST examples use `Ocp-Apim-Subscription-Key`; the service can also mint an auth token from the regional STS endpoint using the speech resource key. The SpeechConfig docs say the config carries key, region, endpoint, host, or auth token.
- Request encoding: short-audio REST sends raw audio bytes with `Content-Type: audio/wav`.
- Response text path: `DisplayText` in simple mode; the detailed REST format exposes `Display` as the human-readable text field.
- Current app assessment: short-audio REST is compatible with the current HTTP proxy. SDK-based realtime would need either the Azure Speech SDK or a backend bridge; there is no direct browser-ready raw STT WebSocket API documented in the same way as the other providers here.
- Official docs:
  - https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-to-text
  - https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-recognize-speech
  - https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-speech-to-text
  - https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short
  - https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text

## Gladia

- Realtime transport: `POST https://api.gladia.io/v2/live` creates a live session and returns a temporary-token WSS URL such as `wss://api.gladia.io/v2/live?token=...`.
- Auth: `x-gladia-key` on the init request; the returned socket URL carries the temporary session token.
- Request shape: init body is JSON and includes `encoding` (`wav/pcm`, `wav/alaw`, `wav/ulaw`), `bit_depth`, `sample_rate`, `channels`, `model`, `endpointing`, `maximum_duration_without_endpointing`, and message selection flags.
- Realtime audio format: the live socket accepts binary frames or base64 `audio_chunk` JSON messages.
- Response text path: live events include `Transcript`, `Post Transcript`, and `Final transcript (aggregated)` event types; the pre-recorded result object exposes `result.text`, with per-segment text under `result.results[].text`.
- Async fallback: `POST /v2/pre-recorded` / `POST /v2/upload` plus `GET /v2/pre-recorded/{id}`.
- Current app assessment: this is the best fit for the current app’s existing HTTP proxy plus browser WebSocket capability, because the init call is HTTP and the live socket uses a temporary URL.
- Official docs:
  - https://docs.gladia.io/api-reference/v2/live/init
  - https://docs.gladia.io/api-reference/v2/live/websocket
  - https://docs.gladia.io/api-reference/v2/pre-recorded/init
  - https://docs.gladia.io/api-reference/v2/pre-recorded/get
  - https://docs.gladia.io/api-reference/authentication

## Soniox

- Realtime transport: `wss://stt-rt.soniox.com`.
- Auth: `Authorization: Bearer <SONIOX_API_KEY>`. The docs also document temporary API keys for client-side use.
- Request shape: after configuration, the client sends binary WebSocket audio frames; the stream ends with an empty WebSocket frame.
- Response text path: realtime responses include `tokens[].text`; the async transcript endpoint returns `text` at `GET /v1/transcriptions/{id}/transcript`.
- Async fallback: create transcription via `POST /v1/transcriptions` with JSON body (`model`, `audio_url` or `file_id`, `language_hints`, etc.), then poll `GET /v1/transcriptions/{id}` and fetch the transcript.
- Current app assessment: async REST is fine with the existing HTTP proxy. Realtime WS is not directly usable without a token-issuing flow or a WS client integration that can authenticate the socket.
- Official docs:
  - https://soniox.com/docs/api-reference
  - https://soniox.com/docs/api-reference/stt/websocket-api
  - https://soniox.com/docs/api-reference/stt/transcriptions/create_transcription
  - https://soniox.com/docs/api-reference/stt/transcriptions/get_transcription
  - https://soniox.com/docs/api-reference/stt/transcriptions/get_transcription_transcript

## Practical takeaway

If the next implementation slice should stay closest to the current app primitives, the most straightforward providers are:

1. Gladia live transcription
2. ElevenLabs transcription with token-based realtime auth or the sync multipart path
3. Azure short-audio REST

Amazon Transcribe is protocol-heavy because of SigV4 + event-stream encoding. Soniox is clean on the API side, but the realtime socket auth shape pushes it out of the “drop into the current Tauri HTTP proxy” lane.
