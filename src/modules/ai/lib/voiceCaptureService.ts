import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSyncExternalStore } from "react";
import type { ProviderId } from "../config";
import {
  createVoiceCaptureModel,
  INITIAL_VOICE_CAPTURE_SNAPSHOT,
  type VoiceCaptureModel,
  type VoiceCaptureModelOptions,
  type VoiceCaptureNativeResult,
} from "./voiceCaptureModel";
import {
  getSpeechToTextRequest,
  transcribeSpeechToText,
  type SpeechToTextRequest,
} from "./speechToText";
import { canRecordCloudAudio, createCloudCaptureSession } from "./voiceCloudCapture";
import { bindVoiceCaptureListeners, type VoiceCaptureListen } from "./voiceCaptureListeners";
import { hasDetectedVoiceActivity } from "./voiceActivity";

export type VoiceCaptureOwner = "floating" | `agent-chat:${string}`;

export type VoiceCaptureStartOptions = {
  ownerKey: VoiceCaptureOwner;
  speechToTextModelId: string;
  apiKeys: Partial<Record<ProviderId, string | null>>;
  developerVocabulary: string;
  onResult: (text: string) => void | Promise<void>;
  onError?: (message: string) => void;
};

export type VoiceCaptureServiceSnapshot = {
  state: "idle" | "recording" | "transcribing";
  activeOwnerKey: VoiceCaptureOwner | null;
  audioLevel: number;
  duration: number;
  error: string | null;
};

export type VoiceCaptureModelFactory = (
  options: VoiceCaptureModelOptions,
) => VoiceCaptureModel;

type VoiceCaptureServiceDependencies = {
  createModel?: VoiceCaptureModelFactory;
  bindListeners?: (options: {
    listen: VoiceCaptureListen;
    onResult: (payload: VoiceCaptureNativeResult) => void;
    onError: (message: string) => void;
    onLevel: (level: number) => void;
  }) => () => void;
};

function recordingFilename(type: string): string {
  return type.includes("mp4") ? "voice.mp4" : "voice.webm";
}

function nativeSpeechStartMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  return "Speech recognition could not start. Try again.";
}

export function createVoiceCaptureService(
  dependencies: VoiceCaptureServiceDependencies = {},
) {
  let snapshot: VoiceCaptureServiceSnapshot = {
    state: INITIAL_VOICE_CAPTURE_SNAPSHOT.state,
    activeOwnerKey: null,
    audioLevel: 0,
    duration: 0,
    error: null,
  };
  let activeOptions: VoiceCaptureStartOptions | null = null;
  let unavailableRequestId: string | null = null;
  let removeListeners: (() => void) | null = null;
  let releaseScheduled = false;
  const subscribers = new Set<() => void>();

  const notify = () => subscribers.forEach((subscriber) => subscriber());

  const releaseIfIdle = () => {
    if (releaseScheduled || snapshot.state !== "idle") return;
    releaseScheduled = true;
    Promise.resolve().then(() => {
      releaseScheduled = false;
      if (snapshot.state !== "idle" || !activeOptions) return;
      activeOptions = null;
      snapshot = { ...snapshot, activeOwnerKey: null };
      notify();
    });
  };

  const publishModelSnapshot: VoiceCaptureModelOptions["onSnapshot"] = (next) => {
    snapshot = {
      ...snapshot,
      state: next.state,
      audioLevel: next.audioLevel,
      duration: next.duration,
    };
    notify();
    releaseIfIdle();
  };

  const model = (dependencies.createModel ?? createVoiceCaptureModel)({
    getCloudRequest: () => {
      if (!activeOptions) return null;
      return getSpeechToTextRequest(activeOptions.speechToTextModelId, activeOptions.apiKeys);
    },
    getUnavailableRequestId: () => unavailableRequestId,
    setUnavailableRequestId: (requestId) => {
      unavailableRequestId = requestId;
    },
    canRecordCloudAudio: () => {
      if (!activeOptions) return false;
      return Boolean(
        getSpeechToTextRequest(activeOptions.speechToTextModelId, activeOptions.apiKeys),
      ) && canRecordCloudAudio();
    },
    createCloudCaptureSession,
    startNativeRecognition: () => invoke("speech_start"),
    stopNativeRecognition: () => invoke("speech_stop"),
    startDurationTicker: (tick) => {
      const timer = window.setInterval(tick, 1_000);
      return () => window.clearInterval(timer);
    },
    transcribeCloudRecording: (
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
    onResult: (text) => activeOptions?.onResult(text),
    onError: (message) => {
      snapshot = { ...snapshot, error: message };
      notify();
      activeOptions?.onError?.(message);
    },
    onSnapshot: publishModelSnapshot,
    detectVoiceActivity: hasDetectedVoiceActivity,
    formatNativeStartError: nativeSpeechStartMessage,
  });

  const ensureListeners = () => {
    if (removeListeners) return;
    const bind = dependencies.bindListeners ?? bindVoiceCaptureListeners;
    removeListeners = bind({
      listen,
      onResult: (payload) => void model.handleNativeResult(payload),
      onError: (message) => model.handleNativeError(message),
      onLevel: (level) => model.handleNativeLevel(level),
    });
  };

  return {
    start(options: VoiceCaptureStartOptions): Promise<boolean> {
      if (snapshot.state !== "idle" || activeOptions) return Promise.resolve(false);
      activeOptions = options;
      snapshot = { ...snapshot, activeOwnerKey: options.ownerKey, error: null };
      notify();
      ensureListeners();
      return model.start(options.developerVocabulary).then(
        () => true,
        (error) => {
          snapshot = {
            ...snapshot,
            state: "idle",
            activeOwnerKey: null,
            error: error instanceof Error ? error.message : String(error),
          };
          activeOptions = null;
          notify();
          return false;
        },
      );
    },
    confirm(ownerKey: VoiceCaptureOwner): void {
      if (snapshot.activeOwnerKey === ownerKey) model.confirm();
    },
    cancel(ownerKey: VoiceCaptureOwner): void {
      if (snapshot.activeOwnerKey !== ownerKey) return;
      model.cancel();
      if (snapshot.state === "idle" && activeOptions?.ownerKey === ownerKey) {
        activeOptions = null;
        snapshot = { ...snapshot, activeOwnerKey: null };
        notify();
      }
    },
    subscribe(subscriber: () => void): () => void {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    getSnapshot(): VoiceCaptureServiceSnapshot {
      return snapshot;
    },
    dispose(): void {
      model.dispose();
      removeListeners?.();
      removeListeners = null;
      activeOptions = null;
      snapshot = {
        ...snapshot,
        state: "idle",
        activeOwnerKey: null,
        audioLevel: 0,
        duration: 0,
      };
      notify();
    },
  };
}

export const voiceCaptureService = createVoiceCaptureService();

export function useVoiceCaptureSnapshot(): VoiceCaptureServiceSnapshot {
  return useSyncExternalStore(
    voiceCaptureService.subscribe,
    voiceCaptureService.getSnapshot,
    voiceCaptureService.getSnapshot,
  );
}
