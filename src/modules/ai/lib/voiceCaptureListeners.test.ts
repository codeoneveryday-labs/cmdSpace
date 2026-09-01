import { describe, expect, it, vi } from "vitest";

import {
  bindVoiceCaptureListeners,
  type VoiceCaptureListen,
} from "./voiceCaptureListeners";

type SpeechResult = { text: string; final: boolean };

const flushListeners = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("bindVoiceCaptureListeners", () => {
  it("forwards native result, error, and level events", async () => {
    const handlers = new Map<string, (event: { payload: unknown }) => void>();
    const listen: VoiceCaptureListen = (event, handler) => {
      handlers.set(event, handler as (event: { payload: unknown }) => void);
      return Promise.resolve(() => undefined);
    };
    const onResult = vi.fn();
    const onError = vi.fn();
    const onLevel = vi.fn();

    const dispose = bindVoiceCaptureListeners({
      listen,
      onResult,
      onError,
      onLevel,
    });
    await flushListeners();

    handlers.get("cmdspace:speech-result")?.({
      payload: { text: "open terminal", final: true } satisfies SpeechResult,
    });
    handlers.get("cmdspace:speech-error")?.({ payload: "microphone blocked" });
    handlers.get("cmdspace:speech-level")?.({ payload: 0.25 });

    expect(onResult).toHaveBeenCalledWith({ text: "open terminal", final: true });
    expect(onError).toHaveBeenCalledWith("microphone blocked");
    expect(onLevel).toHaveBeenCalledWith(0.25);
    dispose();
  });

  it("cleans up every resolved listener exactly once", async () => {
    const unlisten = [vi.fn(), vi.fn(), vi.fn()];
    let next = 0;
    const listen: VoiceCaptureListen = () => Promise.resolve(unlisten[next++]);

    const dispose = bindVoiceCaptureListeners({
      listen,
      onResult: () => undefined,
      onError: () => undefined,
      onLevel: () => undefined,
    });
    await flushListeners();
    dispose();
    dispose();

    expect(unlisten).toEqual([expect.any(Function), expect.any(Function), expect.any(Function)]);
    expect(unlisten[0]).toHaveBeenCalledTimes(1);
    expect(unlisten[1]).toHaveBeenCalledTimes(1);
    expect(unlisten[2]).toHaveBeenCalledTimes(1);
  });

  it("cleans listeners that resolve after disposal", async () => {
    const resolvers: Array<(unlisten: () => void) => void> = [];
    const unlisten = [vi.fn(), vi.fn(), vi.fn()];
    const listen: VoiceCaptureListen = () =>
      new Promise((resolve) => resolvers.push(resolve));

    const dispose = bindVoiceCaptureListeners({
      listen,
      onResult: () => undefined,
      onError: () => undefined,
      onLevel: () => undefined,
    });
    dispose();
    resolvers.forEach((resolve, index) => resolve(unlisten[index]));
    await flushListeners();

    expect(unlisten[0]).toHaveBeenCalledTimes(1);
    expect(unlisten[1]).toHaveBeenCalledTimes(1);
    expect(unlisten[2]).toHaveBeenCalledTimes(1);
  });

  it("cleans already-registered listeners if a later registration rejects", async () => {
    const onUnhandledRejection = vi.fn();
    process.once("unhandledRejection", onUnhandledRejection);
    const unlisten = [vi.fn(), vi.fn()];
    let call = 0;
    const listen: VoiceCaptureListen = () => {
      call += 1;
      if (call === 1) return Promise.resolve(unlisten[0]);
      if (call === 2) return Promise.resolve(unlisten[1]);
      return Promise.reject(new Error("listen failed"));
    };

    const dispose = bindVoiceCaptureListeners({
      listen,
      onResult: () => undefined,
      onError: () => undefined,
      onLevel: () => undefined,
    });

    await flushListeners();
    await flushListeners();
    dispose();
    process.removeListener("unhandledRejection", onUnhandledRejection);

    expect(unlisten[0]).toHaveBeenCalledTimes(1);
    expect(unlisten[1]).toHaveBeenCalledTimes(1);
    expect(onUnhandledRejection).not.toHaveBeenCalled();
  });
});
