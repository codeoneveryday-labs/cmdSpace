import { describe, expect, it } from "vitest";
import {
  getRealtimeSpeechModel,
  parseRealtimeSpeechEvent,
} from "./realtimeSpeech";

describe("realtime speech catalog", () => {
  it("contains only models with documented live transports", () => {
    expect(getRealtimeSpeechModel("deepgram-nova-3-realtime")).toMatchObject({
      provider: "deepgram",
      transport: "websocket",
      audio: { encoding: "linear16", sampleRate: 16_000 },
    });
    expect(getRealtimeSpeechModel("groq-whisper-large-v3-turbo")).toBeNull();
  });
});

describe("parseRealtimeSpeechEvent", () => {
  it("distinguishes a Deepgram interim result from a final utterance", () => {
    expect(
      parseRealtimeSpeechEvent("deepgram", {
        type: "Results",
        is_final: false,
        speech_final: false,
        channel: { alternatives: [{ transcript: "open the" }] },
      }),
    ).toEqual({ kind: "partial", text: "open the" });

    expect(
      parseRealtimeSpeechEvent("deepgram", {
        type: "Results",
        is_final: true,
        speech_final: true,
        channel: { alternatives: [{ transcript: "open the terminal" }] },
      }),
    ).toEqual({ kind: "final", text: "open the terminal" });
  });

  it("parses OpenAI realtime deltas and completed transcription", () => {
    expect(
      parseRealtimeSpeechEvent("openai", {
        type: "conversation.item.input_audio_transcription.delta",
        delta: "hello ",
      }),
    ).toEqual({ kind: "partial", text: "hello " });
    expect(
      parseRealtimeSpeechEvent("openai", {
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "hello cmdspace",
      }),
    ).toEqual({ kind: "final", text: "hello cmdspace" });
  });

  it("keeps AssemblyAI partials distinct from finalized turns", () => {
    expect(
      parseRealtimeSpeechEvent("assemblyai", {
        type: "Turn",
        transcript: "deploy the",
        end_of_turn: false,
      }),
    ).toEqual({ kind: "partial", text: "deploy the" });
    expect(
      parseRealtimeSpeechEvent("assemblyai", {
        type: "Turn",
        transcript: "deploy the app",
        end_of_turn: true,
      }),
    ).toEqual({ kind: "final", text: "deploy the app" });
  });

  it("rejects malformed and provider-mismatched events", () => {
    expect(parseRealtimeSpeechEvent("speechmatics", { type: "Results" })).toBeNull();
    expect(parseRealtimeSpeechEvent("deepgram", null)).toBeNull();
  });
});
