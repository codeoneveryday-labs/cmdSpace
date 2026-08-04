import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPEECH_TO_TEXT_MODEL_ID,
  getSpeechToTextRequest,
  SPEECH_TO_TEXT_MODELS,
} from "./speechToText";

describe("speech-to-text models", () => {
  it("defaults to the existing OpenAI transcription model", () => {
    expect(DEFAULT_SPEECH_TO_TEXT_MODEL_ID).toBe("gpt-4o-transcribe");
  });

  it("offers low-cost cloud providers with their existing provider keys", () => {
    expect(SPEECH_TO_TEXT_MODELS.map((model) => model.provider)).toEqual([
      "openai",
      "groq",
      "nvidia",
    ]);
    expect(
      getSpeechToTextRequest("whisper-large-v3-turbo", {
        groq: "gsk_test",
      }),
    ).toMatchObject({
      provider: "groq",
      endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
      apiKey: "gsk_test",
    });
  });

  it("marks NVIDIA's free hosted model as development-only", () => {
    const model = SPEECH_TO_TEXT_MODELS.find(
      (candidate) => candidate.provider === "nvidia",
    );

    expect(model).toMatchObject({
      developmentOnly: true,
      modelId: "nvidia/parakeet-ctc-1.1b-asr",
      language: "en-US",
      sendModel: false,
      endpoint:
        "https://1598d209-5e27-4d3c-8079-4751568b1081.invocation.api.nvcf.nvidia.com/v1/audio/transcriptions",
    });
  });

  it("does not create a cloud request without the selected provider key", () => {
    expect(getSpeechToTextRequest("gpt-4o-transcribe", {})).toBeNull();
  });
});
