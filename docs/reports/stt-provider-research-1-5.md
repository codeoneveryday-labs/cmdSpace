# STT Provider Research 1–5 — realtime / streaming first

Date: 2026-08-11

Scope: OpenAI, Deepgram, Google Cloud Speech-to-Text, AssemblyAI, Speechmatics. This note prioritizes live transcription transport, auth, endpoint shape, and response contract. Batch/sync is only mentioned when it changes the integration shape.

## Quick matrix

| Provider | Live transport | Auth | Final text path |
| --- | --- | --- | --- |
| OpenAI | Realtime API over WebSocket or WebRTC; input audio transcription is separate from generation. | `Authorization: Bearer $OPENAI_API_KEY`; browser flows should use ephemeral client credentials. | `conversation.item.input_audio_transcription.completed.transcript` |
| Deepgram | WebSocket `wss://api.deepgram.com/v1/listen`. | `Authorization: Token <API_KEY>` or `Authorization: Bearer <JWT>`. | `channel.alternatives[0].transcript` |
| Google Cloud STT | Bidirectional gRPC streaming. | OAuth 2.0 ADC / service account with `cloud-platform` scope. | `results[].alternatives[0].transcript` |
| AssemblyAI | WebSocket `wss://streaming.assemblyai.com/v3/ws`. | `Authorization: <api-key>` with no `Bearer` prefix; browser clients should use a temporary token. | `Turn.transcript` |
| Speechmatics | WebSocket `wss://{region}.rt.speechmatics.com/v2/` or `wss://global.rt.speechmatics.com/v2/`. | `Authorization: Bearer <API_KEY>`; browser clients can use `?jwt=<temporary-key>`. | `AddTranscript.transcript` / `AddPartialTranscript.transcript` |

## OpenAI

- Transport / endpoint: file transcription is `POST https://api.openai.com/v1/audio/transcriptions`; live transcription uses the Realtime API and the docs treat input-audio transcription as a separate ASR path from response generation. [Create transcription](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create), [Realtime server events](https://developers.openai.com/api/reference/resources/realtime/server-events)
- Auth: `Authorization: Bearer $OPENAI_API_KEY`. The Realtime API also supports ephemeral client credentials for browser-style flows. [Create transcription](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create), [Realtime overview](https://developers.openai.com/api/reference/overview/)
- Request encoding: sync transcription is `multipart/form-data` with an uploaded audio file. Realtime sends `input_audio_buffer.append` events carrying base64 audio bytes after the session is configured for transcription. [Create transcription](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create), [Realtime client events](https://developers.openai.com/api/reference/resources/realtime/client-events)
- Response text path: sync transcription returns `text`; realtime partials arrive as `conversation.item.input_audio_transcription.delta` and the final transcript is `conversation.item.input_audio_transcription.completed.transcript`. [Create transcription](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create), [Realtime server events](https://developers.openai.com/api/reference/resources/realtime/server-events)
- Required settings / knobs: the request body includes the audio file and a model such as `gpt-4o-transcribe`; realtime sessions need `input_audio_format` plus an input-audio-transcription config. [Create transcription](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create), [Realtime client events](https://developers.openai.com/api/reference/resources/realtime/client-events)

## Deepgram

- Transport / endpoint: pre-recorded audio uses `POST https://api.deepgram.com/v1/listen`; streaming uses `wss://api.deepgram.com/v1/listen`. [Pre-recorded audio](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded), [Live Audio - streaming API reference](https://developers.deepgram.com/reference/speech-to-text/listen-streaming)
- Auth: `Authorization: Token <API_KEY>` for API keys, or `Authorization: Bearer <JWT>` for temporary tokens. [Token-Based Auth](https://developers.deepgram.com/guides/fundamentals/token-based-authentication), [Live Audio - streaming API reference](https://developers.deepgram.com/reference/speech-to-text/listen-streaming)
- Request encoding: pre-recorded requests can send raw audio bytes or a JSON body with `url`; streaming sends binary audio frames over the WebSocket and raw audio needs `encoding` plus `sample_rate`. [Pre-recorded audio](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded), [Live Audio - streaming API reference](https://developers.deepgram.com/reference/speech-to-text/listen-streaming)
- Response text path: REST responses put transcript text at `results.channels[0].alternatives[0].transcript`; streaming `Results` messages expose `channel.alternatives[0].transcript`. [Pre-recorded audio](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded), [Live Audio - streaming API reference](https://developers.deepgram.com/reference/speech-to-text/listen-streaming)
- Required settings / knobs: `model` is required for streaming; common live knobs include `interim_results`, `endpointing`, `smart_format`, `language`, `multichannel`, and `punctuate`. [Live Audio - streaming API reference](https://developers.deepgram.com/reference/speech-to-text/listen-streaming), [Pre-recorded audio](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded)

## Google Cloud Speech-to-Text

- Transport / endpoint: synchronous REST is `POST https://speech.googleapis.com/v1/speech:recognize`; asynchronous REST is `speech.longrunningrecognize`; live transcription is bidirectional gRPC only. [speech-to-text requests](https://docs.cloud.google.com/speech-to-text/docs/v1/speech-to-text-requests), [Package google.cloud.speech.v1](https://docs.cloud.google.com/speech-to-text/docs/reference/rpc/google.cloud.speech.v1)
- Auth: OAuth 2.0 using Application Default Credentials or a service account with the `https://www.googleapis.com/auth/cloud-platform` scope. [Authenticate to Cloud STT](https://docs.cloud.google.com/speech-to-text/docs/v1/authentication)
- Request encoding: REST uses JSON with `config` (`RecognitionConfig`) and `audio` (`RecognitionAudio`) objects; streaming uses gRPC request messages with audio chunks. [speech.recognize](https://docs.cloud.google.com/speech-to-text/docs/v1/reference/rest/v1/speech/recognize), [Package google.cloud.speech.v1](https://docs.cloud.google.com/speech-to-text/docs/reference/rpc/google.cloud.speech.v1)
- Response text path: the transcript is `results[].alternatives[0].transcript` in `SpeechRecognitionResult`. [Package google.cloud.speech.v1](https://docs.cloud.google.com/speech-to-text/docs/reference/rpc/google.cloud.speech.v1)
- Required settings / knobs: the project must have Speech-to-Text enabled and valid billing/credentials; sync requests are capped at 1 minute, async requests handle longer audio. [speech-to-text requests](https://docs.cloud.google.com/speech-to-text/docs/v1/speech-to-text-requests), [Authenticate to Cloud STT](https://docs.cloud.google.com/speech-to-text/docs/v1/authentication)

## AssemblyAI

- Transport / endpoint: sync short-audio STT is `POST https://sync.assemblyai.com/transcribe`; async pre-recorded STT is `POST https://api.assemblyai.com/v2/transcript`; realtime is `wss://streaming.assemblyai.com/v3/ws`. [Sync STT: transcribe a short audio file](https://www.assemblyai.com/docs/api-reference/sync-api/transcribe), [API Reference overview](https://www.assemblyai.com/docs/api-reference/overview), [Streaming quickstart](https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio)
- Auth: sync HTTP uses `Authorization: <api-key>` with no `Bearer` prefix; the WebSocket handshake also uses the raw API key in `Authorization`; browser clients should use a temporary token. [Sync STT: transcribe a short audio file](https://www.assemblyai.com/docs/api-reference/sync-api/transcribe), [Streaming quickstart](https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio)
- Request encoding: sync uses `multipart/form-data` with `audio` plus a JSON `config` field; realtime sends binary audio chunks after the `Begin` message; async pre-recorded uses `audio_url` or an uploaded file URL. [Sync STT: transcribe a short audio file](https://www.assemblyai.com/docs/api-reference/sync-api/transcribe), [Streaming quickstart](https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio), [Pre-recorded quickstart](https://www.assemblyai.com/docs/pre-recorded-audio/getting-started/transcribe-an-audio-file)
- Response text path: sync returns `text`; async polling returns the transcript object with `text`; realtime `Turn` messages carry `transcript`. [Sync STT: transcribe a short audio file](https://www.assemblyai.com/docs/api-reference/sync-api/transcribe), [Streaming quickstart](https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio), [Get transcript](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/get)
- Required settings / knobs: sync docs require `X-AAI-Model`; realtime examples use `speech_model: "universal-3-5-pro"` and an `encoding`; sync config can include `prompt`, `keyterms_prompt`, `conversation_context`, `language_code`, and `timestamps`. [Sync STT: transcribe a short audio file](https://www.assemblyai.com/docs/api-reference/sync-api/transcribe), [Streaming quickstart](https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio)

## Speechmatics

- Transport / endpoint: realtime is `wss://eu.rt.speechmatics.com/v2/` or `wss://global.rt.speechmatics.com/v2/`; batch async is `POST /jobs`; synchronous batch mode is `POST /jobs?wait=<seconds>&format=<txt|srt|json-v2>`. [Realtime API reference](https://docs.speechmatics.com/api-ref/realtime-transcription-websocket), [Create a new job](https://docs.speechmatics.com/api-ref/batch/create-a-new-job), [Synchronous transcription](https://docs.speechmatics.com/speech-to-text/batch/synchronous)
- Auth: server-side callers use `Authorization: Bearer <API_KEY>`; browser callers should use a temporary JWT in the `jwt` query parameter. [Authentication](https://docs.speechmatics.com/get-started/authentication), [Realtime API reference](https://docs.speechmatics.com/api-ref/realtime-transcription-websocket)
- Request encoding: batch jobs send `data_file` as multipart form data plus a JSON `config`; realtime begins with a `StartRecognition` JSON message that includes `audio_format` and `transcription_config`, then audio frames are sent over the socket. [Create a new job](https://docs.speechmatics.com/api-ref/batch/create-a-new-job), [Realtime API reference](https://docs.speechmatics.com/api-ref/realtime-transcription-websocket)
- Response text path: batch sync embeds the transcript under `txt` when `format=txt`, or under `json-v2` when JSON is requested; realtime final text is `AddTranscript.transcript` and partial text is `AddPartialTranscript.transcript`. [Synchronous transcription](https://docs.speechmatics.com/speech-to-text/batch/synchronous), [Get the transcript for a transcription job](https://docs.speechmatics.com/api-ref/batch/get-the-transcript-for-a-transcription-job), [Realtime API reference](https://docs.speechmatics.com/api-ref/realtime-transcription-websocket)
- Required settings / knobs: `transcription_config.language` is required; common realtime controls include `model`, `enable_partials`, `max_delay`, and `diarization`. [Realtime API reference](https://docs.speechmatics.com/api-ref/realtime-transcription-websocket)

## Decision note

If you want the first implementation slice with the least protocol variance, the cleanest realtime targets are:

1. OpenAI realtime transcription
2. AssemblyAI realtime WebSocket
3. Speechmatics realtime WebSocket

Google is the odd one out because live transcription is gRPC-only, and Deepgram is simple but has a broader mix of live and pre-recorded request shapes.
