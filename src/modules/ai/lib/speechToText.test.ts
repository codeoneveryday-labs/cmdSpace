import { describe, expect, it, vi } from "vitest";
import {
  createSpeechToTextHttpRequest,
  DEFAULT_SPEECH_TO_TEXT_MODEL_ID,
  getSpeechToTextRequest,
  probeSpeechToText,
  SPEECH_TO_TEXT_MODELS,
  transcribeSpeechToText,
} from "./speechToText";

describe("speech-to-text models", () => {
  it("defaults to the existing OpenAI transcription model", () => {
    expect(DEFAULT_SPEECH_TO_TEXT_MODEL_ID).toBe("gpt-4o-transcribe");
  });

  it("offers the expanded cloud provider registry in the original order", () => {
    expect(SPEECH_TO_TEXT_MODELS.map((model) => model.provider)).toEqual([
      "openai",
      "deepgram",
      "google",
      "assemblyai",
      "speechmatics",
      "elevenlabs",
      "aws",
      "azure",
      "gladia",
      "soniox",
      "groq",
      "inworld",
      "rev",
      "verbit",
      "nuance",
      "ibm",
      "cloudflare",
      "fireworks",
      "together",
      "replicate",
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

  it("enables Deepgram Nova-3 once its provider adapter is available", () => {
    const model = SPEECH_TO_TEXT_MODELS.find(
      (candidate) => candidate.provider === "deepgram",
    );

    expect(model).toMatchObject({
      modelId: "nova-3",
      endpoint: "https://api.deepgram.com/v1/listen",
    });
    expect(model?.developmentOnly).toBeUndefined();
    expect(getSpeechToTextRequest("nova-3", { deepgram: "dg_test" })).toMatchObject({
      provider: "deepgram",
      apiKey: "dg_test",
    });
  });

  it("does not create a cloud request without the selected provider key", () => {
    expect(getSpeechToTextRequest("gpt-4o-transcribe", {})).toBeNull();
  });

  it("probes the selected STT endpoint with an in-memory audio sample", async () => {
    const request = getSpeechToTextRequest("gpt-4o-transcribe", {
      openai: "test-key",
    });
    const fetcher = vi.fn().mockResolvedValue(new Response('{"text":""}'));

    await expect(probeSpeechToText(request!, fetcher)).resolves.toBeUndefined();

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
      }),
    );
    const form = fetcher.mock.calls[0][1].body as FormData;
    expect(form.get("model")).toBe("gpt-4o-transcribe");
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(form.get("prompt")).toContain("cmdSpace");
    expect(form.get("prompt")).toContain("TypeScript");
    expect(form.get("prompt")).toContain("tiếng Việt");
  });

  it("sends Deepgram audio with Token auth, Vietnamese multilingual mode, and keyterms", async () => {
    const request = getSpeechToTextRequest("nova-3", { deepgram: "dg_test" });
    const recording = new Blob(["audio"], { type: "audio/webm" });
    const prepared = createSpeechToTextHttpRequest(
      recording,
      "voice.webm",
      request!,
      "cmdSpace, Prisma, Zod",
    );

    const url = new URL(prepared.endpoint);
    expect(url.origin + url.pathname).toBe("https://api.deepgram.com/v1/listen");
    expect(url.searchParams.get("model")).toBe("nova-3");
    expect(url.searchParams.get("language")).toBe("multi");
    expect(url.searchParams.getAll("keyterm")).toEqual(
      expect.arrayContaining(["cmdSpace", "TypeScript", "Prisma", "Zod"]),
    );
    expect(prepared.headers).toEqual({
      Authorization: "Token dg_test",
      "Content-Type": "audio/webm",
    });
    expect(prepared.body).toBe(recording);
  });

  it("reads Deepgram's nested transcript response", async () => {
    const request = getSpeechToTextRequest("nova-3", { deepgram: "dg_test" });
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: { channels: [{ alternatives: [{ transcript: "mở package json" }] }] },
        }),
      ),
    );

    await expect(
      transcribeSpeechToText(
        new Blob(["audio"], { type: "audio/webm" }),
        "voice.webm",
        request!,
        "package.json",
        fetcher,
      ),
    ).resolves.toBe("mở package json");
    expect(fetcher.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({ Authorization: "Token dg_test" }),
    );
  });

  it("surfaces the STT endpoint failure", async () => {
    const request = getSpeechToTextRequest("gpt-4o-transcribe", {
      openai: "test-key",
    });

    await expect(
      probeSpeechToText(
        request!,
        vi.fn().mockResolvedValue(new Response("", { status: 401 })),
      ),
    ).rejects.toThrow("OpenAI transcription check failed (401).");
  });
});
