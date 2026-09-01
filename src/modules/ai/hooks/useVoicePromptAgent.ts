import { useCallback, useEffect, useRef, useState } from "react";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type { ProviderKeys } from "../lib/keyring";
import {
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
