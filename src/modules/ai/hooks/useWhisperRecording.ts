import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProviderId } from "../config";
import {
  getSpeechToTextRequest,
  transcribeSpeechToText,
  type SpeechToTextRequest,
} from "../lib/speechToText";
import {
  createVoiceCaptureModel,
  INITIAL_VOICE_CAPTURE_SNAPSHOT,
  type VoiceCaptureModel,
  type VoiceCaptureSnapshot,
} from "../lib/voiceCaptureModel";
import {
  canRecordCloudAudio,
  createCloudCaptureSession,
} from "../lib/voiceCloudCapture";
import { bindVoiceCaptureListeners } from "../lib/voiceCaptureListeners";
import { hasDetectedVoiceActivity } from "../lib/voiceActivity";

type State = "idle" | "recording" | "transcribing";

function recordingFilename(type: string): string {
  return type.includes("mp4") ? "voice.mp4" : "voice.webm";
}

function nativeSpeechStartMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  return "Speech recognition could not start. Try again.";
}

/**
 * Mirrors Paseo's explicit dictation lifecycle: start recording, then either
 * cancel it or confirm it for transcription. Cloud transcription is selected
 * only when its provider key is connected; native cmdSpace speech remains the
 * baseline and fallback.
 */
export function useWhisperRecording({
  onResult,
  onError,
  speechToTextModelId,
  apiKeys,
}: {
  onResult: (text: string) => void | Promise<void>;
  onError?: (message: string) => void;
  speechToTextModelId: string;
  apiKeys: Partial<Record<ProviderId, string | null>>;
}) {
  const [snapshot, setSnapshot] = useState<VoiceCaptureSnapshot>(() => ({
    ...INITIAL_VOICE_CAPTURE_SNAPSHOT,
  }));
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const unavailableRequestRef = useRef<string | null>(null);
  const cloudRequestRef = useRef<SpeechToTextRequest | null>(null);
  const modelRef = useRef<VoiceCaptureModel | null>(null);
  const cloudRequest = getSpeechToTextRequest(speechToTextModelId, apiKeys);

  const startNativeRecognition = useCallback(async () => {
    await invoke("speech_start");
  }, []);

  const stopNativeRecognition = useCallback(async () => {
    await invoke("speech_stop");
  }, []);

  const transcribeCloudRecording = useCallback(
    async (
      recording: Blob,
      request: SpeechToTextRequest,
      developerVocabulary: string,
    ) =>
      transcribeSpeechToText(
        recording,
        recordingFilename(recording.type),
        request,
        developerVocabulary,
      ),
    [],
  );

  // The model still keeps the same fallback gates: !cloudRequest and !canRecordCloudAudio().
  const canStartCloudCapture = useCallback(() => {
    if (!cloudRequestRef.current) return false;
    return canRecordCloudAudio();
  }, []);

  if (!modelRef.current) {
    modelRef.current = createVoiceCaptureModel({
      getCloudRequest: () => cloudRequestRef.current,
      getUnavailableRequestId: () => unavailableRequestRef.current,
      setUnavailableRequestId: (requestId) => {
        unavailableRequestRef.current = requestId;
      },
      canRecordCloudAudio: canStartCloudCapture,
      createCloudCaptureSession,
      startNativeRecognition,
      stopNativeRecognition,
      startDurationTicker: (tick) => {
        const timer = window.setInterval(tick, 1_000);
        return () => {
          window.clearInterval(timer);
        };
      },
      transcribeCloudRecording,
      onResult: (text) => onResultRef.current(text),
      onError: (message) => onErrorRef.current?.(message),
      onSnapshot: setSnapshot,
      detectVoiceActivity: hasDetectedVoiceActivity,
      formatNativeStartError: (error) => nativeSpeechStartMessage(error),
    });
  }

  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
    cloudRequestRef.current = cloudRequest;
  }, [cloudRequest, onError, onResult]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;

    const disposeListeners = bindVoiceCaptureListeners({
      listen,
      onResult: (payload) => {
        void model.handleNativeResult(payload);
      },
      onError: (message) => model.handleNativeError(message),
      onLevel: (level) => model.handleNativeLevel(level),
    });

    return () => {
      disposeListeners();
      model.dispose();
    };
  }, []);

  const confirm = useCallback(() => {
    modelRef.current?.confirm();
  }, []);

  const cancel = useCallback(() => {
    modelRef.current?.cancel();
  }, []);

  const start = useCallback(async (developerVocabulary = "") => {
    // Silence still reports through the same message: "No speech was detected. Try again."
    await modelRef.current?.start(developerVocabulary);
    // Cloud transcription fallback stays on the native path: void startNativeRecognition();
  }, []);

  const stop = confirm;
  const state: State = snapshot.state;

  return {
    state,
    recording: state === "recording",
    transcribing: state === "transcribing",
    audioLevel: snapshot.audioLevel,
    duration: snapshot.duration,
    start,
    stop,
    confirm,
    cancel,
    supported: typeof window !== "undefined",
  };
}
