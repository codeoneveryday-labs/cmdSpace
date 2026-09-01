import { describe, expect, it, vi } from "vitest";

import {
  createCloudCaptureSession,
  type VoiceCloudCapturePort,
} from "./voiceCloudCapture";

function createHarness(options: { failRecorder?: boolean } = {}) {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const analyser = {
    fftSize: 4,
    getByteTimeDomainData: vi.fn((samples: Uint8Array) => samples.fill(128)),
  } as unknown as AnalyserNode;
  const context = {
    state: "running",
    close: vi.fn(async () => undefined),
    createAnalyser: vi.fn(() => analyser),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
  } as unknown as AudioContext;
  const recorder = {
    state: "recording",
    mimeType: "audio/webm",
    ondataavailable: null as ((event: BlobEvent) => void) | null,
    onstop: null as (() => void) | null,
    start: vi.fn(),
    stop: vi.fn(),
  } as unknown as MediaRecorder;
  const requestFrame = vi.fn(() => 42);
  const cancelFrame = vi.fn();
  const port: VoiceCloudCapturePort = {
    acquireStream: vi.fn(async () => stream),
    createAudioContext: vi.fn(() => context),
    createRecorder: vi.fn(() => {
      if (options.failRecorder) throw new Error("recorder unavailable");
      return recorder;
    }),
    supportsMime: vi.fn(() => true),
    requestFrame,
    cancelFrame,
  };

  return { analyser, cancelFrame, context, port, recorder, track };
}

describe("createCloudCaptureSession", () => {
  it("stops browser capture resources after confirming a recording", async () => {
    const harness = createHarness();
    const onLevel = vi.fn();
    const onStop = vi.fn();

    const session = await createCloudCaptureSession({ onLevel, onStop }, harness.port);
    harness.recorder.ondataavailable?.({ data: new Blob(["audio"]) } as BlobEvent);
    session.stop();
    harness.recorder.onstop?.(new Event("stop"));

    expect(harness.recorder.start).toHaveBeenCalledTimes(1);
    expect(harness.recorder.stop).toHaveBeenCalledTimes(1);
    expect(onLevel).toHaveBeenCalled();
    expect(onStop).toHaveBeenCalledWith(expect.any(Blob));
    expect(harness.track.stop).toHaveBeenCalledTimes(1);
    expect(harness.context.close).toHaveBeenCalledTimes(1);
    expect(harness.cancelFrame).toHaveBeenCalledWith(42);
  });

  it("suppresses the transcription callback for canceled browser capture", async () => {
    const harness = createHarness();
    const onStop = vi.fn();
    const session = await createCloudCaptureSession(
      { onLevel: () => undefined, onStop },
      harness.port,
    );

    session.cancel();

    expect(onStop).not.toHaveBeenCalled();
    expect(harness.track.stop).toHaveBeenCalledTimes(1);
    expect(harness.context.close).toHaveBeenCalledTimes(1);
    expect(harness.cancelFrame).toHaveBeenCalledWith(42);

    harness.recorder.onstop?.(new Event("stop"));
    expect(onStop).not.toHaveBeenCalled();
  });

  it("cleans browser capture resources immediately when the session is disposed", async () => {
    const harness = createHarness();
    const onStop = vi.fn();
    const session = await createCloudCaptureSession(
      { onLevel: () => undefined, onStop },
      harness.port,
    );

    session.dispose();

    expect(harness.recorder.stop).toHaveBeenCalledTimes(1);
    expect(harness.track.stop).toHaveBeenCalledTimes(1);
    expect(harness.context.close).toHaveBeenCalledTimes(1);
    expect(harness.cancelFrame).toHaveBeenCalledWith(42);

    harness.recorder.onstop?.(new Event("stop"));
    expect(onStop).not.toHaveBeenCalled();
  });

  it("cleans stream and animation resources when recorder construction fails", async () => {
    const harness = createHarness({ failRecorder: true });

    await expect(
      createCloudCaptureSession(
        { onLevel: () => undefined, onStop: () => undefined },
        harness.port,
      ),
    ).rejects.toThrow("recorder unavailable");

    expect(harness.track.stop).toHaveBeenCalledTimes(1);
    expect(harness.context.close).toHaveBeenCalledTimes(1);
    expect(harness.cancelFrame).toHaveBeenCalledWith(42);
  });
});
