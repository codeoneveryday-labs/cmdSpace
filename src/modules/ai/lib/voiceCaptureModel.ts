import type { SpeechToTextRequest } from "./speechToText";
import { hasDetectedVoiceActivity } from "./voiceActivity";

export type VoiceCaptureState = "idle" | "recording" | "transcribing";

export type VoiceCaptureSnapshot = {
  state: VoiceCaptureState;
  audioLevel: number;
  duration: number;
};

export type VoiceCaptureNativeResult = {
  text: string;
  final: boolean;
};

export type VoiceCloudCaptureCallbacks = {
  onLevel: (level: number) => void;
  onStop: (recording: Blob) => void | Promise<void>;
};

export type VoiceCloudCaptureSession = {
  stop: () => void;
  cancel: () => void;
  dispose: () => void;
};

type VoiceCaptureModelOptions = {
  getCloudRequest: () => SpeechToTextRequest | null;
  getUnavailableRequestId?: () => string | null;
  setUnavailableRequestId?: (requestId: string | null) => void;
  canRecordCloudAudio: () => boolean;
  createCloudCaptureSession: (
    callbacks: VoiceCloudCaptureCallbacks,
  ) => Promise<VoiceCloudCaptureSession>;
  startNativeRecognition: () => Promise<void>;
  stopNativeRecognition: () => Promise<void>;
  startDurationTicker: (tick: () => void) => () => void;
  transcribeCloudRecording: (
    recording: Blob,
    request: SpeechToTextRequest,
    developerVocabulary: string,
  ) => Promise<string>;
  onResult: (text: string) => void | Promise<void>;
  onError?: (message: string) => void;
  onSnapshot: (snapshot: VoiceCaptureSnapshot) => void;
  detectVoiceActivity?: (level: number) => boolean;
  formatNativeStartError?: (error: unknown) => string;
  logger?: {
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
};

export type VoiceCaptureModel = {
  start: (developerVocabulary?: string) => Promise<void>;
  confirm: () => void;
  stop: () => void;
  cancel: () => void;
  dispose: () => void;
  handleNativeResult: (payload: VoiceCaptureNativeResult) => Promise<void>;
  handleNativeError: (message: string) => void;
  handleNativeLevel: (level: number) => void;
  getSnapshot: () => VoiceCaptureSnapshot;
};

export const INITIAL_VOICE_CAPTURE_SNAPSHOT: VoiceCaptureSnapshot = {
  state: "idle",
  audioLevel: 0,
  duration: 0,
};

const DEFAULT_NATIVE_START_ERROR =
  "Speech recognition could not start. Try again.";
const STOP_ERROR = "Speech recognition could not stop cleanly. Try again.";
const NO_SPEECH_ERROR = "No speech was detected. Try again.";

export function createVoiceCaptureModel(
  options: VoiceCaptureModelOptions,
): VoiceCaptureModel {
  let snapshot: VoiceCaptureSnapshot = { ...INITIAL_VOICE_CAPTURE_SNAPSHOT };
  let disposed = false;
  let startingSessionId: number | null = null;
  let finished = false;
  let pendingConfirm = false;
  let mode: "native" | "cloud" | null = null;
  let developerVocabulary = "";
  let voiceDetected = false;
  let stopDurationTicker: (() => void) | null = null;
  let cloudSession: VoiceCloudCaptureSession | null = null;
  let cloudSessionId = 0;
  let captureSessionId = 0;
  let nativeOperationTail: Promise<void> | null = null;

  const logger = options.logger ?? console;
  const detectVoiceActivity =
    options.detectVoiceActivity ?? hasDetectedVoiceActivity;
  const formatNativeStartError =
    options.formatNativeStartError ??
    ((error: unknown) =>
      error instanceof Error && error.message
        ? error.message
        : DEFAULT_NATIVE_START_ERROR);

  function publish(next: VoiceCaptureSnapshot) {
    snapshot = next;
    options.onSnapshot(next);
  }

  function patch(next: Partial<VoiceCaptureSnapshot>) {
    publish({ ...snapshot, ...next });
  }

  function setState(state: VoiceCaptureState) {
    if (snapshot.state === state) return;
    patch({ state });
  }

  function setAudioLevel(audioLevel: number) {
    if (snapshot.audioLevel === audioLevel) return;
    patch({ audioLevel });
  }

  function setDuration(duration: number) {
    if (snapshot.duration === duration) return;
    patch({ duration });
  }

  function requestIdFor(request: SpeechToTextRequest | null) {
    return request ? `${request.modelId}:${request.apiKey}` : null;
  }

  function isCurrentCapture(sessionId: number) {
    return !disposed && sessionId === captureSessionId;
  }

  function queueNativeOperation(operation: () => Promise<void>) {
    let scheduled: Promise<void>;
    if (nativeOperationTail) {
      scheduled = nativeOperationTail.then(operation, operation);
    } else {
      try {
        scheduled = operation();
      } catch (error) {
        scheduled = Promise.reject(error);
      }
    }

    const settled = scheduled.catch(() => undefined);
    nativeOperationTail = settled;
    void settled.finally(() => {
      if (nativeOperationTail === settled) nativeOperationTail = null;
    });
    return scheduled;
  }

  function stopDurationTracking() {
    if (!stopDurationTicker) return;
    stopDurationTicker();
    stopDurationTicker = null;
  }

  function startDurationTracking() {
    if (stopDurationTicker || disposed) return;
    stopDurationTicker = options.startDurationTicker(() => {
      patch({ duration: snapshot.duration + 1 });
    });
  }

  function cleanupCloudSession(targetSessionId?: number) {
    if (
      targetSessionId !== undefined &&
      targetSessionId !== cloudSessionId
    ) {
      return;
    }
    const active = cloudSession;
    cloudSession = null;
    if (active) active.dispose();
  }

  function resetToIdle() {
    mode = null;
    setAudioLevel(0);
    setState("idle");
  }

  async function finishWithTranscript(text: string, sessionId: number) {
    if (finished || !isCurrentCapture(sessionId)) return;
    stopDurationTracking();
    const transcript = text.trim();
    if (!transcript || !voiceDetected) {
      finished = true;
      resetToIdle();
      options.onError?.(NO_SPEECH_ERROR);
      return;
    }

    finished = true;
    setAudioLevel(0);
    setState("transcribing");
    try {
      await options.onResult(transcript);
    } catch (error) {
      logger.error("speech.onResult", error);
    } finally {
      if (!isCurrentCapture(sessionId)) return;
      mode = null;
      setState("idle");
    }
  }

  async function beginNativeRecognition(sessionId: number) {
    if (!isCurrentCapture(sessionId)) return;
    mode = "native";
    try {
      await queueNativeOperation(options.startNativeRecognition);
    } catch (error) {
      if (!isCurrentCapture(sessionId) || mode !== "native") return;
      logger.error("nativeSpeech.start", error);
      finished = true;
      mode = null;
      stopDurationTracking();
      setState("idle");
      options.onError?.(formatNativeStartError(error));
    }
  }

  async function handleCloudStop(
    sessionId: number,
    captureId: number,
    recording: Blob,
    request: SpeechToTextRequest,
  ) {
    if (!isCurrentCapture(captureId) || sessionId !== cloudSessionId) return;
    cleanupCloudSession(sessionId);

    if (recording.size === 0 || finished) {
      resetToIdle();
      return;
    }

    setState("transcribing");
    try {
      const transcript = await options.transcribeCloudRecording(
        recording,
        request,
        developerVocabulary,
      );
      await finishWithTranscript(transcript, captureId);
    } catch (error) {
      if (!isCurrentCapture(captureId) || sessionId !== cloudSessionId) return;
      logger.error("cloudSpeech.transcribe", error);
      options.setUnavailableRequestId?.(requestIdFor(request));
      if (disposed) return;
      finished = false;
      voiceDetected = false;
      mode = null;
      setAudioLevel(0);
      setDuration(0);
      setState("recording");
      startDurationTracking();
      await beginNativeRecognition(captureId);
    }
  }

  async function beginCloudRecording(
    request: SpeechToTextRequest,
    captureId: number,
  ) {
    if (!isCurrentCapture(captureId)) return;
    const sessionId = cloudSessionId + 1;
    cloudSessionId = sessionId;
    mode = "cloud";
    const session = await options.createCloudCaptureSession({
      onLevel: (level) => {
        if (
          !isCurrentCapture(captureId) ||
          sessionId !== cloudSessionId ||
          mode !== "cloud"
        ) {
          return;
        }
        const nextLevel = Number.isFinite(level)
          ? Math.min(1, Math.max(0, level))
          : 0;
        if (detectVoiceActivity(nextLevel)) voiceDetected = true;
        setAudioLevel(Math.max(nextLevel, snapshot.audioLevel * 0.72));
      },
      onStop: (recording) =>
        handleCloudStop(sessionId, captureId, recording, request),
    });

    if (
      !isCurrentCapture(captureId) ||
      sessionId !== cloudSessionId ||
      mode !== "cloud"
    ) {
      session.cancel();
      session.dispose();
      return;
    }

    cloudSession = session;
    if (pendingConfirm) {
      pendingConfirm = false;
      session.stop();
    }
  }

  return {
    async start(nextDeveloperVocabulary = "") {
      if (
        snapshot.state !== "idle" ||
        startingSessionId !== null ||
        disposed
      ) {
        return;
      }

      const sessionId = captureSessionId + 1;
      captureSessionId = sessionId;
      startingSessionId = sessionId;
      developerVocabulary = nextDeveloperVocabulary;
      finished = false;
      voiceDetected = false;
      setAudioLevel(0);
      setDuration(0);
      startDurationTracking();
      setState("recording");

      try {
        const cloudRequest = options.getCloudRequest();
        const requestId = requestIdFor(cloudRequest);

        if (
          !cloudRequest ||
          options.getUnavailableRequestId?.() === requestId ||
          !options.canRecordCloudAudio()
        ) {
          await beginNativeRecognition(sessionId);
          return;
        }

        try {
          await beginCloudRecording(cloudRequest, sessionId);
        } catch (error) {
          if (!isCurrentCapture(sessionId)) return;
          logger.warn("cloudSpeech.capture", error);
          cleanupCloudSession();
          if (pendingConfirm) {
            pendingConfirm = false;
            resetToIdle();
            return;
          }
          await beginNativeRecognition(sessionId);
        }
      } finally {
        if (startingSessionId === sessionId) {
          startingSessionId = null;
        }
      }
    },

    confirm() {
      if (disposed || snapshot.state !== "recording") return;

      stopDurationTracking();
      setAudioLevel(0);
      if (mode === "cloud") {
        if (cloudSession) {
          cloudSession.stop();
        } else {
          pendingConfirm = true;
        }
        return;
      }

      setState("transcribing");
      const sessionId = captureSessionId;
      void queueNativeOperation(options.stopNativeRecognition).catch((error) => {
        if (!isCurrentCapture(sessionId) || mode !== "native") return;
        logger.error("nativeSpeech.stop", error);
        finished = true;
        mode = null;
        setState("idle");
        options.onError?.(STOP_ERROR);
      });
    },

    stop() {
      this.confirm();
    },

    cancel() {
      if (disposed) return;

      captureSessionId += 1;
      startingSessionId = null;
      finished = true;
      pendingConfirm = false;
      stopDurationTracking();
      setAudioLevel(0);
      setDuration(0);
      if (mode === "cloud") {
        cloudSession?.cancel();
        cleanupCloudSession();
      } else if (mode === "native") {
        void queueNativeOperation(options.stopNativeRecognition).catch(() => undefined);
      }
      mode = null;
      setState("idle");
    },

    dispose() {
      if (disposed) return;

      disposed = true;
      captureSessionId += 1;
      startingSessionId = null;
      finished = true;
      pendingConfirm = false;
      stopDurationTracking();
      if (cloudSession) {
        cloudSession.cancel();
        cleanupCloudSession();
      }
      void queueNativeOperation(options.stopNativeRecognition).catch(() => undefined);
      mode = null;
    },

    async handleNativeResult(payload) {
      if (!payload.final || mode !== "native" || disposed) return;
      await finishWithTranscript(payload.text, captureSessionId);
    },

    handleNativeError(message) {
      if (mode !== "native" || disposed) return;

      finished = true;
      mode = null;
      setAudioLevel(0);
      stopDurationTracking();
      setState("idle");
      options.onError?.(message);
    },

    handleNativeLevel(level) {
      if (mode !== "native" || disposed) return;

      const nextLevel = Number.isFinite(level)
        ? Math.min(1, Math.max(0, level))
        : 0;
      if (detectVoiceActivity(nextLevel)) voiceDetected = true;
      setAudioLevel(Math.max(nextLevel, snapshot.audioLevel * 0.72));
    },

    getSnapshot() {
      return snapshot;
    },
  };
}
