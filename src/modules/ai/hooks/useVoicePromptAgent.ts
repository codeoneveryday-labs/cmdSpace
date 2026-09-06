import { useCallback, useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type { ProviderKeys } from "../lib/keyring";
import {
  NO_ACTIVE_VOICE_TARGET_MESSAGE,
  resolveVoiceTranscriptInsertion,
  type SpeechInputTarget,
} from "../lib/voiceTranscriptInsertionModel";
import { useWhisperRecording } from "./useWhisperRecording";

export type { SpeechInputTarget } from "../lib/voiceTranscriptInsertionModel";

export type SpeechInputStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "inserting"
  | "ready"
  | "error";

type Options = {
  apiKeys: ProviderKeys;
  captureTarget: () => SpeechInputTarget | null;
  captureVocabulary: () => Promise<string>;
  insertTranscript: (target: SpeechInputTarget, transcript: string) => boolean;
};

const READY_DURATION_MS = 2_800;
export const MACOS_MICROPHONE_SETTINGS_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";

export function isMicrophonePermissionError(message: string | null): boolean {
  return message?.startsWith("Microphone access is blocked.") ?? false;
}

export function useSpeechToTextInput({
  apiKeys,
  captureTarget,
  captureVocabulary,
  insertTranscript,
}: Options) {
  const speechToTextModelId = usePreferencesStore(
    (state) => state.speechToTextModelId,
  );
  const [phase, setPhase] = useState<
    "idle" | "inserting" | "ready" | "error"
  >(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const targetRef = useRef<SpeechInputTarget | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const clearLater = useCallback(() => {
    if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      setPhase("idle");
      setMessage(null);
      clearTimerRef.current = null;
    }, READY_DURATION_MS);
  }, []);

  const setError = useCallback((nextMessage: string) => {
    setPhase("error");
    setMessage(nextMessage);
  }, []);

  const handleTranscript = useCallback(
    async (transcript: string) => {
      setPhase("inserting");
      setMessage("Inserting transcript…");
      const outcome = resolveVoiceTranscriptInsertion(
        targetRef.current,
        transcript,
        insertTranscript,
      );
      if (outcome.kind === "error") {
        setError(outcome.message);
        return;
      }
      setPhase("ready");
      setMessage(outcome.message);
      clearLater();
    },
    [clearLater, insertTranscript, setError],
  );

  const recorder = useWhisperRecording({
    ownerKey: "floating",
    onResult: handleTranscript,
    onError: setError,
    speechToTextModelId,
    apiKeys,
  });

  const start = useCallback(async (targetOverride?: SpeechInputTarget) => {
    if (recorder.transcribing || phase === "inserting") return;
    if (!recorder.supported) {
      setError("Voice recording is not supported in this window.");
      return;
    }
    const target = targetOverride ?? captureTarget();
    if (!target) {
      setError(NO_ACTIVE_VOICE_TARGET_MESSAGE);
      return;
    }
    targetRef.current = target;
    if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
    setPhase("idle");
    setMessage(null);
    await recorder.start(await captureVocabulary());
  }, [captureTarget, captureVocabulary, phase, recorder, setError]);

  const toggle = useCallback(async () => {
    if (recorder.recording) {
      recorder.stop();
      return;
    }
    if (phase === "error" && isMicrophonePermissionError(message)) {
      try {
        await openUrl(MACOS_MICROPHONE_SETTINGS_URL);
      } catch (error) {
        setError(
          error instanceof Error && error.message
            ? error.message
            : "Could not open macOS Microphone settings. Open System Settings → Privacy & Security → Microphone, then try again.",
        );
      }
      return;
    }
    await start();
  }, [message, phase, recorder, setError, start]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  const status: SpeechInputStatus = recorder.recording
    ? "listening"
    : recorder.transcribing
      ? "transcribing"
      : phase;

  return {
    status,
    message,
    toggle,
    start,
    stop: recorder.stop,
    busyElsewhere: recorder.busyElsewhere,
    audioLevel: recorder.audioLevel,
  };
}
