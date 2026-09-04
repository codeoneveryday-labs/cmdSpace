import { describe, expect, it, vi } from "vitest";

import type { SpeechToTextRequest } from "./speechToText";
import {
  createVoiceCaptureModel,
  INITIAL_VOICE_CAPTURE_SNAPSHOT,
  type VoiceCloudCaptureSession,
  type VoiceCaptureSnapshot,
} from "./voiceCaptureModel";

function createRequest(): SpeechToTextRequest {
  return {
    provider: "openai",
    modelId: "gpt-4o-transcribe",
    label: "OpenAI",
    description: "test request",
    endpoint: "https://api.openai.com/v1/audio/transcriptions",
    apiKey: "test-key",
  };
}

describe("createVoiceCaptureModel", () => {
  it("starts and stops native capture with the existing speech commands", async () => {
    const harness = createHarness({ cloudRequest: null });

    await harness.model.start();
    harness.model.handleNativeLevel(0.04);
    harness.tickDuration();
    harness.model.confirm();
    await harness.model.handleNativeResult({ text: "open terminal", final: true });

    expect(harness.startNativeRecognition).toHaveBeenCalledTimes(1);
    expect(harness.stopNativeRecognition).toHaveBeenCalledTimes(1);
    expect(harness.onResult).toHaveBeenCalledWith("open terminal");
    expect(harness.snapshot).toEqual({
      state: "idle",
      audioLevel: 0,
      duration: 1,
    });
  });

  it("accepts native final text when microphone level events were missed", async () => {
    const harness = createHarness({ cloudRequest: null });

    await harness.model.start();
    harness.model.confirm();
    await harness.model.handleNativeResult({ text: "open terminal", final: true });

    expect(harness.onResult).toHaveBeenCalledWith("open terminal");
    expect(harness.onError).not.toHaveBeenCalled();
  });

  it("serializes rapid native cancel/restart and ignores an old start failure", async () => {
    const firstStart = deferred<void>();
    const pendingStop = deferred<void>();
    const calls: string[] = [];
    let startAttempts = 0;
    const harness = createHarness({
      cloudRequest: null,
      startNativeRecognition: vi.fn(() => {
        startAttempts += 1;
        calls.push(`start:${startAttempts}`);
        return startAttempts === 1 ? firstStart.promise : Promise.resolve();
      }),
      stopNativeRecognition: vi.fn(() => {
        calls.push("stop");
        return pendingStop.promise;
      }),
    });

    const initialStart = harness.model.start();
    await Promise.resolve();
    harness.model.cancel();
    const restarted = harness.model.start();

    expect(calls).toEqual(["start:1"]);

    firstStart.reject(new Error("stale start failure"));
    await initialStart;
    await Promise.resolve();

    expect(calls).toEqual(["start:1", "stop"]);
    expect(harness.onError).not.toHaveBeenCalled();
    expect(harness.snapshot.state).toBe("recording");

    pendingStop.resolve();
    await restarted;

    expect(calls).toEqual(["start:1", "stop", "start:2"]);
    expect(harness.snapshot.state).toBe("recording");
  });

  it("captures cloud audio, transcribes it, and returns to idle", async () => {
    const harness = createHarness();

    await harness.model.start("workspace terms");
    harness.emitCloudLevel(0.06);
    harness.tickDuration(2);
    harness.model.confirm();
    await harness.finishCloudCapture(new Blob(["audio"], { type: "audio/webm" }));

    expect(harness.createCloudCaptureSession).toHaveBeenCalledTimes(1);
    expect(harness.cloudSession.stop).toHaveBeenCalledTimes(1);
    expect(harness.cloudSession.dispose).toHaveBeenCalledTimes(1);
    expect(harness.transcribeCloudRecording).toHaveBeenCalledWith(
      expect.any(Blob),
      createRequest(),
      "workspace terms",
    );
    expect(harness.onResult).toHaveBeenCalledWith("transcribed cloud speech");
    expect(harness.snapshot).toEqual({
      state: "idle",
      audioLevel: 0,
      duration: 2,
    });
  });

  it("drops zero-byte cloud recordings without transcribing or erroring", async () => {
    const harness = createHarness();

    await harness.model.start();
    harness.model.confirm();
    await harness.finishCloudCapture(new Blob([], { type: "audio/webm" }));

    expect(harness.transcribeCloudRecording).not.toHaveBeenCalled();
    expect(harness.onResult).not.toHaveBeenCalled();
    expect(harness.onError).not.toHaveBeenCalled();
    expect(harness.snapshot).toEqual({
      state: "idle",
      audioLevel: 0,
      duration: 0,
    });
  });

  it("rejects transcripts when no voice activity was detected", async () => {
    const harness = createHarness();

    await harness.model.start();
    harness.model.confirm();
    await harness.finishCloudCapture(new Blob(["audio"], { type: "audio/webm" }));

    expect(harness.onResult).not.toHaveBeenCalled();
    expect(harness.onError).toHaveBeenCalledWith("No speech was detected. Try again.");
    expect(harness.snapshot).toEqual({
      state: "idle",
      audioLevel: 0,
      duration: 0,
    });
  });

  it("falls back to native capture after cloud transcription fails", async () => {
    const harness = createHarness({
      transcribeCloudRecording: vi
        .fn<(recording: Blob, request: SpeechToTextRequest, vocabulary: string) => Promise<string>>()
        .mockRejectedValue(new Error("cloud unavailable")),
    });

    await harness.model.start("cmdSpace");
    harness.emitCloudLevel(0.06);
    harness.model.confirm();
    await harness.finishCloudCapture(new Blob(["audio"], { type: "audio/webm" }));

    expect(harness.transcribeCloudRecording).toHaveBeenCalledWith(
      expect.any(Blob),
      createRequest(),
      "cmdSpace",
    );
    expect(harness.startNativeRecognition).toHaveBeenCalledTimes(1);
    expect(harness.cloudSession.stop).toHaveBeenCalledTimes(1);
    expect(harness.cloudSession.dispose).toHaveBeenCalledTimes(1);
    expect(harness.snapshot).toEqual({
      state: "recording",
      audioLevel: 0,
      duration: 0,
    });
    expect(harness.durationTicks.size).toBe(1);
  });

  it("cancels an active cloud capture and clears transient state", async () => {
    const harness = createHarness();

    await harness.model.start();
    harness.emitCloudLevel(0.08);
    harness.tickDuration(3);
    harness.model.cancel();

    expect(harness.cloudSession.cancel).toHaveBeenCalledTimes(1);
    expect(harness.cloudSession.dispose).toHaveBeenCalledTimes(1);
    expect(harness.onResult).not.toHaveBeenCalled();
    expect(harness.snapshot).toEqual({
      state: "idle",
      audioLevel: 0,
      duration: 0,
    });
    expect(harness.durationTicks.size).toBe(0);
  });

  it("cleans up active resources on dispose", async () => {
    const harness = createHarness();

    await harness.model.start();
    harness.emitCloudLevel(0.09);
    harness.tickDuration();
    harness.model.dispose();

    expect(harness.cloudSession.cancel).toHaveBeenCalledTimes(1);
    expect(harness.cloudSession.dispose).toHaveBeenCalledTimes(1);
    expect(harness.stopNativeRecognition).toHaveBeenCalledTimes(1);
    expect(harness.durationTicks.size).toBe(0);
  });

  it("uses native capture immediately after the same cloud request has failed", async () => {
    const harness = createHarness({
      transcribeCloudRecording: vi
        .fn<(recording: Blob, request: SpeechToTextRequest, vocabulary: string) => Promise<string>>()
        .mockRejectedValue(new Error("cloud unavailable")),
    });

    await harness.model.start();
    harness.emitCloudLevel(0.06);
    harness.model.confirm();
    await harness.finishCloudCapture(new Blob(["audio"], { type: "audio/webm" }));
    harness.model.cancel();

    await harness.model.start();

    expect(harness.createCloudCaptureSession).toHaveBeenCalledTimes(1);
    expect(harness.startNativeRecognition).toHaveBeenCalledTimes(2);
  });

  it("falls back to native capture when cloud setup fails before recording starts", async () => {
    const harness = createHarness({
      createCloudCaptureSession: vi
        .fn()
        .mockRejectedValue(new Error("microphone unavailable")),
    });

    await harness.model.start("cmdSpace");

    expect(harness.createCloudCaptureSession).toHaveBeenCalledTimes(1);
    expect(harness.startNativeRecognition).toHaveBeenCalledTimes(1);
    expect(harness.transcribeCloudRecording).not.toHaveBeenCalled();
    expect(harness.snapshot).toEqual({
      state: "recording",
      audioLevel: 0,
      duration: 0,
    });
    expect(harness.durationTicks.size).toBe(1);
  });

  it("honors confirm that arrives while cloud capture setup is still pending", async () => {
    let resolveSession!: (session: VoiceCloudCaptureSession) => void;
    const harness = createHarness({
      createCloudCaptureSession: () =>
        new Promise<VoiceCloudCaptureSession>((resolve) => {
            resolveSession = resolve;
        }),
    });

    const startPromise = harness.model.start("cmdSpace");
    harness.model.confirm();
    resolveSession(harness.cloudSession);
    await startPromise;
    await harness.finishCloudCapture(new Blob(["audio"], { type: "audio/webm" }));

    expect(harness.cloudSession.stop).toHaveBeenCalledTimes(1);
    expect(harness.cloudSession.dispose).toHaveBeenCalledTimes(1);
    expect(harness.transcribeCloudRecording).toHaveBeenCalledWith(
      expect.any(Blob),
      createRequest(),
      "cmdSpace",
    );
    expect(harness.onResult).not.toHaveBeenCalled();
    expect(harness.onError).toHaveBeenCalledWith("No speech was detected. Try again.");
    expect(harness.snapshot).toEqual({
      state: "idle",
      audioLevel: 0,
      duration: 0,
    });
  });

  it("does not publish a snapshot during model construction", () => {
    const onSnapshot = vi.fn();

    const model = createVoiceCaptureModel({
      getCloudRequest: () => null,
      canRecordCloudAudio: () => false,
      createCloudCaptureSession: vi.fn(),
      startNativeRecognition: vi.fn(async () => undefined),
      stopNativeRecognition: vi.fn(async () => undefined),
      startDurationTicker: () => () => undefined,
      transcribeCloudRecording: vi.fn(async () => ""),
      onResult: vi.fn(async () => undefined),
      onSnapshot,
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
      },
    });

    expect(onSnapshot).not.toHaveBeenCalled();
    expect(model.getSnapshot()).toEqual(INITIAL_VOICE_CAPTURE_SNAPSHOT);
  });
});

type HarnessOptions = {
  cloudRequest?: SpeechToTextRequest | null;
  canRecordCloudAudio?: boolean;
  startNativeRecognition?: () => Promise<void>;
  stopNativeRecognition?: () => Promise<void>;
  createCloudCaptureSession?: (
    callbacks: {
      onLevel: (level: number) => void;
      onStop: (recording: Blob) => void | Promise<void>;
    },
  ) => Promise<{
    stop: () => void;
    cancel: () => void;
    dispose: () => void;
  }>;
  transcribeCloudRecording?: (
    recording: Blob,
    request: SpeechToTextRequest,
    vocabulary: string,
  ) => Promise<string>;
};

function createHarness(options: HarnessOptions = {}) {
  const request = options.cloudRequest === undefined ? createRequest() : options.cloudRequest;
  const snapshots: VoiceCaptureSnapshot[] = [];
  const durationTicks = new Set<() => void>();
  let unavailableRequestId: string | null = null;
  const onResult = vi.fn(async (_text: string) => undefined);
  const onError = vi.fn();
  const startNativeRecognition = options.startNativeRecognition
    ? vi.fn(options.startNativeRecognition)
    : vi.fn(async () => undefined);
  const stopNativeRecognition = options.stopNativeRecognition
    ? vi.fn(options.stopNativeRecognition)
    : vi.fn(async () => undefined);
  const transcribeCloudRecording = options.transcribeCloudRecording
    ? vi.fn(options.transcribeCloudRecording)
    : vi.fn(async () => "transcribed cloud speech");
  let snapshot: VoiceCaptureSnapshot = {
    state: "idle",
    audioLevel: 0,
    duration: 0,
  };
  let cloudStopHandler: ((recording: Blob) => void | Promise<void>) | null = null;
  let cloudLevelHandler: ((level: number) => void) | null = null;
  const cloudSession = {
    stop: vi.fn(),
    cancel: vi.fn(),
    dispose: vi.fn(),
  };
  const createCloudCaptureSession = options.createCloudCaptureSession
    ? vi.fn(
        async ({
          onLevel,
          onStop,
        }: {
          onLevel: (level: number) => void;
          onStop: (recording: Blob) => void | Promise<void>;
        }) => {
          cloudLevelHandler = onLevel;
          cloudStopHandler = onStop;
          return options.createCloudCaptureSession?.({ onLevel, onStop }) as Promise<{
            stop: () => void;
            cancel: () => void;
            dispose: () => void;
          }>;
        },
      )
    : vi.fn(
        async ({
          onLevel,
          onStop,
        }: {
          onLevel: (level: number) => void;
          onStop: (recording: Blob) => void | Promise<void>;
        }) => {
          cloudLevelHandler = onLevel;
          cloudStopHandler = onStop;
          return cloudSession;
        },
      );

  const model = createVoiceCaptureModel({
    getCloudRequest: () => request,
    getUnavailableRequestId: () => unavailableRequestId,
    setUnavailableRequestId: (next) => {
      unavailableRequestId = next;
    },
    canRecordCloudAudio: () => options.canRecordCloudAudio ?? true,
    createCloudCaptureSession,
    startNativeRecognition,
    stopNativeRecognition,
    startDurationTicker: (tick) => {
      durationTicks.add(tick);
      return () => {
        durationTicks.delete(tick);
      };
    },
    transcribeCloudRecording,
    onResult,
    onError,
    onSnapshot: (next) => {
      snapshots.push(next);
      snapshot = next;
    },
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
    },
  });

  return {
    model,
    get snapshot() {
      return snapshot;
    },
    snapshots,
    durationTicks,
    cloudSession,
    createCloudCaptureSession,
    startNativeRecognition,
    stopNativeRecognition,
    transcribeCloudRecording,
    onResult,
    onError,
    tickDuration(times = 1) {
      for (let index = 0; index < times; index += 1) {
        for (const tick of [...durationTicks]) tick();
      }
    },
    emitCloudLevel(level: number) {
      cloudLevelHandler?.(level);
    },
    async finishCloudCapture(recording: Blob) {
      await cloudStopHandler?.(recording);
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}
