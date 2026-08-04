import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProviderId } from "../config";
import {
  getSpeechToTextRequest,
  type SpeechToTextRequest,
} from "../lib/speechToText";
import { hasDetectedVoiceActivity } from "../lib/voiceActivity";

type State = "idle" | "recording" | "transcribing";
type CaptureMode = "native" | "cloud";

const AUTO_STOP_AFTER_VOICE_SILENCE_MS = 1_200;

type SpeechResult = {
  text: string;
  final: boolean;
};

function canRecordCloudAudio(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined" &&
    typeof FormData !== "undefined" &&
    typeof File !== "undefined"
  );
}

function recorderOptions(): MediaRecorderOptions | undefined {
  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
    (candidate) => MediaRecorder.isTypeSupported(candidate),
  );
  return mimeType ? { mimeType } : undefined;
}

function recordingFilename(type: string): string {
  return type.includes("mp4") ? "voice.mp4" : "voice.webm";
}

function nativeSpeechStartMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  return "Speech recognition could not start. Try again.";
}

/**
 * Uses the selected cloud transcription model when its provider key is
 * connected. Native cmdSpace speech remains the baseline and fallback, so
 * voice input keeps working without a cloud key, when browser audio capture
 * fails, and on the next attempt after a cloud transcription failure.
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
  const [state, setState] = useState<State>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const startingRef = useRef(false);
  const finishedRef = useRef(false);
  const modeRef = useRef<CaptureMode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceDetectedRef = useRef(false);
  const activityFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const unavailableRequestRef = useRef<string | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const cloudRequest = getSpeechToTextRequest(speechToTextModelId, apiKeys);

  const clearSilenceStop = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopCapture = useCallback(() => {
    clearSilenceStop();
    setAudioLevel(0);
    if (modeRef.current === "cloud") {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      return;
    }
    void invoke("speech_stop").catch((error) => {
      console.error("nativeSpeech.stop", error);
      finishedRef.current = true;
      modeRef.current = null;
      setState("idle");
      onErrorRef.current?.("Speech recognition could not stop cleanly. Try again.");
    });
  }, [clearSilenceStop]);

  const scheduleSilenceStop = useCallback(
    (level: number) => {
      if (!hasDetectedVoiceActivity(level)) return;
      voiceDetectedRef.current = true;
      clearSilenceStop();
      silenceTimerRef.current = window.setTimeout(
        stopCapture,
        AUTO_STOP_AFTER_VOICE_SILENCE_MS,
      );
    },
    [clearSilenceStop, stopCapture],
  );

  const stopCloudActivityMonitor = useCallback(() => {
    if (activityFrameRef.current !== null) {
      window.cancelAnimationFrame(activityFrameRef.current);
      activityFrameRef.current = null;
    }
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close();
  }, []);

  const stopCloudTracks = useCallback(() => {
    stopCloudActivityMonitor();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, [stopCloudActivityMonitor]);

  const monitorCloudActivity = useCallback((stream: MediaStream) => {
    try {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      const samples = new Uint8Array(analyser.fftSize);
      context.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = context;

      const measure = () => {
        analyser.getByteTimeDomainData(samples);
        const rms = Math.sqrt(
          samples.reduce((sum, sample) => {
            const amplitude = (sample - 128) / 128;
            return sum + amplitude * amplitude;
          }, 0) / samples.length,
        );
        const level = Math.min(1, rms * 8);
        scheduleSilenceStop(level);
        setAudioLevel((previous) => Math.max(level, previous * 0.72));
        activityFrameRef.current = window.requestAnimationFrame(measure);
      };
      measure();
    } catch (error) {
      console.warn("cloudSpeech.activity", error);
    }
  }, [scheduleSilenceStop]);

  const finishWithTranscript = useCallback(async (text: string) => {
    const transcript = text.trim();
    if (finishedRef.current) return;
    clearSilenceStop();
    if (!transcript || !voiceDetectedRef.current) {
      finishedRef.current = true;
      modeRef.current = null;
      setAudioLevel(0);
      setState("idle");
      onErrorRef.current?.("No speech was detected. Try again.");
      return;
    }
    finishedRef.current = true;
    setAudioLevel(0);
    setState("transcribing");
    try {
      await onResultRef.current(transcript);
    } catch (error) {
      console.error("speech.onResult", error);
    } finally {
      modeRef.current = null;
      setState("idle");
    }
  }, [clearSilenceStop]);

  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onError, onResult]);

  useEffect(() => {
    let unlistenResult: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    let unlistenLevel: (() => void) | undefined;
    let disposed = false;

    void Promise.all([
      listen<SpeechResult>("cmdspace:speech-result", ({ payload }) => {
        if (!payload.final || modeRef.current !== "native") return;
        void finishWithTranscript(payload.text);
      }),
      listen<string>("cmdspace:speech-error", ({ payload }) => {
        if (modeRef.current !== "native") return;
        finishedRef.current = true;
        modeRef.current = null;
        setAudioLevel(0);
        setState("idle");
        onErrorRef.current?.(payload);
      }),
      listen<number>("cmdspace:speech-level", ({ payload }) => {
        if (modeRef.current !== "native") return;
        const nextLevel = Number.isFinite(payload)
          ? Math.min(1, Math.max(0, payload))
          : 0;
        scheduleSilenceStop(nextLevel);
        setAudioLevel((previous) => Math.max(nextLevel, previous * 0.72));
      }),
    ]).then(([result, error, level]) => {
      if (disposed) {
        result();
        error();
        level();
        return;
      }
      unlistenResult = result;
      unlistenError = error;
      unlistenLevel = level;
    });

    return () => {
      disposed = true;
      finishedRef.current = true;
      clearSilenceStop();
      unlistenResult?.();
      unlistenError?.();
      unlistenLevel?.();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopCloudTracks();
      void invoke("speech_stop").catch(() => undefined);
    };
  }, [clearSilenceStop, finishWithTranscript, scheduleSilenceStop, stopCloudTracks]);

  const startNativeRecognition = useCallback(async () => {
    modeRef.current = "native";
    try {
      await invoke("speech_start");
    } catch (error) {
      console.error("nativeSpeech.start", error);
      finishedRef.current = true;
      modeRef.current = null;
      setState("idle");
      onErrorRef.current?.(nativeSpeechStartMessage(error));
    }
  }, []);

  const transcribeCloudRecording = useCallback(
    async (recording: Blob, request: SpeechToTextRequest) => {
      const formData = new FormData();
      formData.append(
        "file",
        new File([recording], recordingFilename(recording.type), {
          type: recording.type || "audio/webm",
        }),
      );
      if (request.sendModel !== false) {
        formData.append("model", request.modelId);
      }
      if (request.language) formData.append("language", request.language);

      const response = await fetch(request.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${request.apiKey}` },
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`${request.provider} transcription failed (${response.status}).`);
      }
      const payload: unknown = await response.json();
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("text" in payload) ||
        typeof payload.text !== "string"
      ) {
        throw new Error(`${request.provider} transcription returned no text.`);
      }
      await finishWithTranscript(payload.text);
    },
    [finishWithTranscript],
  );

  const startCloudRecording = useCallback(
    async (request: SpeechToTextRequest) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      monitorCloudActivity(stream);
      const recorder = new MediaRecorder(stream, recorderOptions());
      recorderRef.current = recorder;
      chunksRef.current = [];
      modeRef.current = "cloud";

      recorder.ondataavailable = ({ data }) => {
        if (data.size > 0) chunksRef.current.push(data);
      };
      recorder.onstop = () => {
        recorderRef.current = null;
        stopCloudTracks();
        const audio = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        if (audio.size === 0 || finishedRef.current) {
          modeRef.current = null;
          setState("idle");
          return;
        }
        setState("transcribing");
        void transcribeCloudRecording(audio, request).catch((error) => {
          console.error("cloudSpeech.transcribe", error);
          unavailableRequestRef.current = `${request.modelId}:${request.apiKey}`;
          finishedRef.current = false;
          voiceDetectedRef.current = false;
          setState("recording");
          void startNativeRecognition();
        });
      };
      recorder.start();
    },
    [monitorCloudActivity, startNativeRecognition, stopCloudTracks, transcribeCloudRecording],
  );

  const stop = useCallback(() => stopCapture(), [stopCapture]);

  const start = useCallback(async () => {
    if (state !== "idle" || startingRef.current) return;

    startingRef.current = true;
    finishedRef.current = false;
    voiceDetectedRef.current = false;
    clearSilenceStop();
    setAudioLevel(0);
    setState("recording");
    try {
      const requestId = cloudRequest
        ? `${cloudRequest.modelId}:${cloudRequest.apiKey}`
        : null;
      if (
        !cloudRequest ||
        unavailableRequestRef.current === requestId ||
        !canRecordCloudAudio()
      ) {
        await startNativeRecognition();
        return;
      }
      try {
        await startCloudRecording(cloudRequest);
      } catch (error) {
        console.warn("cloudSpeech.capture", error);
        stopCloudTracks();
        await startNativeRecognition();
      }
    } finally {
      startingRef.current = false;
    }
  }, [clearSilenceStop, cloudRequest, startCloudRecording, startNativeRecognition, state, stopCloudTracks]);

  return {
    state,
    recording: state === "recording",
    transcribing: state === "transcribing",
    audioLevel,
    start,
    stop,
    supported: typeof window !== "undefined",
  };
}
