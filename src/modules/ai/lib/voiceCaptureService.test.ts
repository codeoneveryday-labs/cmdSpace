import { describe, expect, it, vi } from "vitest";
import {
  createVoiceCaptureService,
  type VoiceCaptureModelFactory,
  type VoiceCaptureStartOptions,
} from "./voiceCaptureService";

function createFakeModelFactory(): VoiceCaptureModelFactory {
  return (options) => ({
    start: async () => {
      options.onSnapshot({ state: "recording", audioLevel: 0, duration: 0 });
    },
    confirm: () => {
      options.onSnapshot({ state: "idle", audioLevel: 0, duration: 0 });
    },
    stop: () => {
      options.onSnapshot({ state: "idle", audioLevel: 0, duration: 0 });
    },
    cancel: () => {
      options.onSnapshot({ state: "idle", audioLevel: 0, duration: 0 });
    },
    dispose: vi.fn(),
    handleNativeResult: vi.fn(),
    handleNativeError: vi.fn(),
    handleNativeLevel: vi.fn(),
    getSnapshot: () => ({ state: "idle", audioLevel: 0, duration: 0 }),
  });
}

const startOptions = (ownerKey: "floating" | `agent-chat:${string}`) => ({
  ownerKey,
  speechToTextModelId: "gpt-4o-transcribe",
  apiKeys: {},
  developerVocabulary: "",
  onResult: vi.fn(),
});

describe("voice capture service", () => {
  it("allows one owner and rejects a second owner while capture is active", async () => {
    const service = createVoiceCaptureService({
      createModel: createFakeModelFactory(),
      bindListeners: () => () => undefined,
    });

    await expect(service.start(startOptions("floating"))).resolves.toBe(true);
    await expect(service.start(startOptions("agent-chat:chat-2"))).resolves.toBe(false);
    expect(service.getSnapshot().activeOwnerKey).toBe("floating");
  });

  it("releases the owner after cancel so another owner can capture", async () => {
    const service = createVoiceCaptureService({
      createModel: createFakeModelFactory(),
      bindListeners: () => () => undefined,
    });

    await service.start(startOptions("floating"));
    service.cancel("floating");
    await Promise.resolve();

    await expect(service.start(startOptions("agent-chat:chat-2"))).resolves.toBe(true);
    expect(service.getSnapshot().activeOwnerKey).toBe("agent-chat:chat-2");
  });

  it("binds the active owner's callbacks once and keeps native listeners shared", async () => {
    const modelOptions: { current: Parameters<VoiceCaptureModelFactory>[0] | null } = {
      current: null,
    };
    let bindCount = 0;
    const floatingResult = vi.fn();
    const service = createVoiceCaptureService({
      createModel: (options) => {
        modelOptions.current = options;
        return createFakeModelFactory()(options);
      },
      bindListeners: () => {
        bindCount += 1;
        return () => undefined;
      },
    });
    const options: VoiceCaptureStartOptions = {
      ...startOptions("floating"),
      onResult: floatingResult,
    };

    await service.start(options);
    if (!modelOptions.current) throw new Error("fake model options were not captured");
    await modelOptions.current.onResult("hello");
    expect(floatingResult).toHaveBeenCalledWith("hello");
    service.cancel("floating");
    await Promise.resolve();
    await service.start(startOptions("agent-chat:chat-2"));
    expect(bindCount).toBe(1);
  });
});
