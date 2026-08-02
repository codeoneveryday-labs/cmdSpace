import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

type State = "idle" | "recording" | "transcribing";
type CaptureMode = "native" | "openai";

type SpeechResult = {
  text: string;
  final: boolean;
};

const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_TRANSCRIPTION_MODEL = "gpt-4o-transcribe";

function canRecordOpenAiAudio(): boolean {
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
 * Uses OpenAI's multilingual transcription when the user supplied an OpenAI
 * key. Native cmdSpace speech remains the baseline and fallback, so voice
 * input keeps working without a cloud key, when browser audio capture fails,
 * and on the next attempt after a cloud transcription failure.
 */
export function useWhisperRecording({
  onResult,
  onError,
  openAiApiKey,
}: {
  onResult: (text: string) => void | Promise<void>;
  onError?: (message: string) => void;
  openAiApiKey?: string | null;
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
  const openAiUnavailableRef = useRef(false);
  const previousOpenAiKeyRef = useRef(openAiApiKey);

  const stopOpenAiTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const finishWithTranscript = useCallback(async (text: string) => {
    const transcript = text.trim();
    if (!transcript || finishedRef.current) return;
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
  }, []);

  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onError, onResult]);

  useEffect(() => {
    if (previousOpenAiKeyRef.current === openAiApiKey) return;
    previousOpenAiKeyRef.current = openAiApiKey;
    openAiUnavailableRef.current = false;
  }, [openAiApiKey]);

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
      unlistenResult?.();
      unlistenError?.();
      unlistenLevel?.();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopOpenAiTracks();
      void invoke("speech_stop").catch(() => undefined);
    };
  }, [finishWithTranscript, stopOpenAiTracks]);

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

  const transcribeOpenAiRecording = useCallback(
    async (recording: Blob, apiKey: string) => {
      const formData = new FormData();
      formData.append(
        "file",
        new File([recording], recordingFilename(recording.type), {
          type: recording.type || "audio/webm",
        }),
      );
      formData.append("model", OPENAI_TRANSCRIPTION_MODEL);

      const response = await fetch(OPENAI_TRANSCRIPTION_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`OpenAI transcription failed (${response.status}).`);
      }
      const payload: unknown = await response.json();
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("text" in payload) ||
        typeof payload.text !== "string"
      ) {
        throw new Error("OpenAI transcription returned no text.");
      }
      await finishWithTranscript(payload.text);
    },
    [finishWithTranscript],
  );

  const startOpenAiRecording = useCallback(
    async (apiKey: string) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, recorderOptions());
      recorderRef.current = recorder;
      chunksRef.current = [];
      modeRef.current = "openai";

      recorder.ondataavailable = ({ data }) => {
        if (data.size > 0) chunksRef.current.push(data);
      };
      recorder.onstop = () => {
        recorderRef.current = null;
        stopOpenAiTracks();
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
        void transcribeOpenAiRecording(audio, apiKey).catch((error) => {
          console.error("openaiSpeech.transcribe", error);
          openAiUnavailableRef.current = true;
          finishedRef.current = true;
          modeRef.current = null;
          setState("idle");
          onErrorRef.current?.("Voice transcription failed. Try again.");
        });
      };
      recorder.start();
    },
    [stopOpenAiTracks, transcribeOpenAiRecording],
  );

  const stop = useCallback(() => {
    setAudioLevel(0);
    if (modeRef.current === "openai") {
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
  }, []);

  const start = useCallback(async () => {
    if (state !== "idle" || startingRef.current) return;

    startingRef.current = true;
    finishedRef.current = false;
    setAudioLevel(0);
    setState("recording");
    try {
      if (
        !openAiApiKey ||
        openAiUnavailableRef.current ||
        !canRecordOpenAiAudio()
      ) {
        await startNativeRecognition();
        return;
      }
      try {
        await startOpenAiRecording(openAiApiKey);
      } catch (error) {
        console.warn("openaiSpeech.capture", error);
        stopOpenAiTracks();
        await startNativeRecognition();
      }
    } finally {
      startingRef.current = false;
    }
  }, [openAiApiKey, startNativeRecognition, startOpenAiRecording, state, stopOpenAiTracks]);

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
