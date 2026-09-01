import type { VoiceCaptureNativeResult } from "./voiceCaptureModel";

export type VoiceCaptureListen = <Payload>(
  event: string,
  handler: (event: { payload: Payload }) => void,
) => Promise<() => void>;

type Options = {
  listen: VoiceCaptureListen;
  onResult: (payload: VoiceCaptureNativeResult) => void;
  onError: (message: string) => void;
  onLevel: (level: number) => void;
};

export function bindVoiceCaptureListeners({
  listen,
  onResult,
  onError,
  onLevel,
}: Options): () => void {
  let disposed = false;
  let unlisteners: Array<() => void> = [];
  let failed = false;

  const cleanup = () => {
    const active = unlisteners;
    unlisteners = [];
    active.forEach((unlisten) => unlisten());
  };

  const register = (registration: Promise<() => void>) => {
    void registration
      .then((unlisten) => {
        if (disposed || failed) {
          unlisten();
          return;
        }
        unlisteners.push(unlisten);
      })
      .catch(() => {
        if (disposed || failed) return;
        failed = true;
        cleanup();
      });
  };

  register(listen<VoiceCaptureNativeResult>("cmdspace:speech-result", ({ payload }) => {
      onResult(payload);
    }));
  register(listen<string>("cmdspace:speech-error", ({ payload }) => {
      onError(payload);
    }));
  register(listen<number>("cmdspace:speech-level", ({ payload }) => {
      onLevel(payload);
  }));

  return () => {
    if (disposed) return;
    disposed = true;
    cleanup();
  };
}
