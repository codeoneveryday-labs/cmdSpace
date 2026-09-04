import { useCallback, useEffect } from "react";
import type { ProviderId } from "../config";
import {
  voiceCaptureService,
  useVoiceCaptureSnapshot,
  type VoiceCaptureOwner,
} from "../lib/voiceCaptureService";

export function useWhisperRecording({
  ownerKey,
  onResult,
  onError,
  speechToTextModelId,
  apiKeys,
}: {
  ownerKey: VoiceCaptureOwner;
  onResult: (text: string) => void | Promise<void>;
  onError?: (message: string) => void;
  speechToTextModelId: string;
  apiKeys: Partial<Record<ProviderId, string | null>>;
}) {
  const snapshot = useVoiceCaptureSnapshot();
  const owned = snapshot.activeOwnerKey === ownerKey;
  const busyElsewhere =
    snapshot.state !== "idle" && snapshot.activeOwnerKey !== ownerKey;
  const start = useCallback(
    (developerVocabulary = "") =>
      voiceCaptureService.start({
        ownerKey,
        speechToTextModelId,
        apiKeys,
        developerVocabulary,
        onResult,
        onError,
      }),
    [apiKeys, onError, onResult, ownerKey, speechToTextModelId],
  );
  const confirm = useCallback(
    () => voiceCaptureService.confirm(ownerKey),
    [ownerKey],
  );
  const cancel = useCallback(
    () => voiceCaptureService.cancel(ownerKey),
    [ownerKey],
  );

  useEffect(() => {
    return () => voiceCaptureService.cancel(ownerKey);
  }, [ownerKey]);

  return {
    recording: owned && snapshot.state === "recording",
    transcribing: owned && snapshot.state === "transcribing",
    busyElsewhere,
    audioLevel: owned ? snapshot.audioLevel : 0,
    duration: owned ? snapshot.duration : 0,
    start,
    stop: confirm,
    confirm,
    cancel,
    supported: typeof window !== "undefined",
  };
}
