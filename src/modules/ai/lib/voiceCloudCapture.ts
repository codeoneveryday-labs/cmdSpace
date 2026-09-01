import type {
  VoiceCloudCaptureCallbacks,
  VoiceCloudCaptureSession,
} from "./voiceCaptureModel";

export type VoiceCloudCapturePort = {
  acquireStream: () => Promise<MediaStream>;
  createAudioContext: () => AudioContext;
  createRecorder: (
    stream: MediaStream,
    options?: MediaRecorderOptions,
  ) => MediaRecorder;
  supportsMime: (mimeType: string) => boolean;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
};

function browserPort(): VoiceCloudCapturePort {
  return {
    acquireStream: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    createAudioContext: () => new AudioContext(),
    createRecorder: (stream, options) => new MediaRecorder(stream, options),
    supportsMime: (mimeType) => MediaRecorder.isTypeSupported(mimeType),
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
  };
}

export function canRecordCloudAudio(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined" &&
    typeof FormData !== "undefined" &&
    typeof File !== "undefined"
  );
}

function recorderOptions(port: VoiceCloudCapturePort): MediaRecorderOptions | undefined {
  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
    (candidate) => port.supportsMime(candidate),
  );
  return mimeType ? { mimeType } : undefined;
}

export async function createCloudCaptureSession(
  { onLevel, onStop }: VoiceCloudCaptureCallbacks,
  port: VoiceCloudCapturePort = browserPort(),
): Promise<VoiceCloudCaptureSession> {
  const stream = await port.acquireStream();
  let cancelled = false;
  let cleanedUp = false;
  let audioContext: AudioContext | null = null;
  let activityFrame: number | null = null;
  let chunks: Blob[] = [];

  const stopActivityMonitor = () => {
    if (activityFrame !== null) {
      port.cancelFrame(activityFrame);
      activityFrame = null;
    }
    const context = audioContext;
    audioContext = null;
    if (context && context.state !== "closed") void context.close();
  };

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    stopActivityMonitor();
    stream.getTracks().forEach((track) => track.stop());
  };

  try {
    const context = port.createAudioContext();
    const analyser = context.createAnalyser();
    const samples = new Uint8Array(analyser.fftSize);
    context.createMediaStreamSource(stream).connect(analyser);
    audioContext = context;

    const measure = () => {
      if (cleanedUp) return;
      analyser.getByteTimeDomainData(samples);
      const rms = Math.sqrt(
        samples.reduce((sum, sample) => {
          const amplitude = (sample - 128) / 128;
          return sum + amplitude * amplitude;
        }, 0) / samples.length,
      );
      onLevel(Math.min(1, rms * 8));
      activityFrame = port.requestFrame(measure);
    };

    measure();
  } catch (error) {
    console.warn("cloudSpeech.activity", error);
  }

  try {
    const recorder = port.createRecorder(stream, recorderOptions(port));
    recorder.ondataavailable = ({ data }) => {
      if (data.size > 0) chunks.push(data);
    };
    recorder.onstop = () => {
      const audio = new Blob(chunks, {
        type: recorder.mimeType || "audio/webm",
      });
      chunks = [];
      cleanup();
      if (cancelled) return;
      void onStop(audio);
    };
    recorder.start();

    return {
      stop() {
        if (recorder.state === "recording") recorder.stop();
      },
      cancel() {
        cancelled = true;
        chunks = [];
        cleanup();
        if (recorder.state === "recording") recorder.stop();
      },
      dispose() {
        cancelled = true;
        chunks = [];
        cleanup();
        if (recorder.state === "recording") recorder.stop();
      },
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
