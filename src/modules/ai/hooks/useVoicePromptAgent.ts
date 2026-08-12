import { useCallback, useEffect, useRef, useState } from "react";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type { ProviderKeys } from "../lib/keyring";
import { useWhisperRecording } from "./useWhisperRecording";

export type SpeechInputTarget =
  | {
      kind: "terminal-pane";
      tabId: number;
      terminalId: number;
    }
  | {
      kind: "canvas-terminal";
      tabId: number;
      terminalId: string;
    };

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

function messageFor(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Voice transcript insertion failed. Try again.";
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
      const target = targetRef.current;
      if (!target) {
        setError("The target terminal is no longer available.");
        return;
      }

      setPhase("inserting");
      setMessage("Inserting transcript…");
      try {
        if (!insertTranscript(target, transcript)) {
          throw new Error(
            "The terminal is busy. Wait for the command to finish, then try again.",
          );
        }
        setPhase("ready");
        setMessage("Transcript inserted into terminal.");
        clearLater();
      } catch (error) {
        setError(messageFor(error));
      }
    },
    [clearLater, insertTranscript, setError],
  );

  const recorder = useWhisperRecording({
    onResult: handleTranscript,
    onError: setError,
    speechToTextModelId,
    apiKeys,
  });

  const toggle = useCallback(async () => {
    if (recorder.recording) {
      recorder.stop();
      return;
    }
    if (recorder.transcribing || phase === "inserting") return;
    if (!recorder.supported) {
      setError("Voice recording is not supported in this window.");
      return;
    }
    targetRef.current = captureTarget();
    if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
    setPhase("idle");
    setMessage(null);
    await recorder.start(await captureVocabulary());
  }, [captureTarget, captureVocabulary, phase, recorder, setError]);

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

  return { status, message, toggle, audioLevel: recorder.audioLevel };
}
