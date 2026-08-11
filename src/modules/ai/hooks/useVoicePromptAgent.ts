import { useCallback, useEffect, useRef, useState } from "react";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { parseSpaceCommand, type SpaceCommand } from "../lib/spaceCommand";
import type { ProviderKeys } from "../lib/keyring";
import { useWhisperRecording } from "./useWhisperRecording";

export type VoiceDraftTarget =
  | {
      kind: "terminal-pane";
      tabId: number;
      terminalId: number;
      cwd: string | null;
      terminalContext: string | null;
    }
  | {
      kind: "canvas-terminal";
      tabId: number;
      terminalId: string;
      cwd: string | null;
      terminalContext: string | null;
    };

export type VoiceAgentStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "refining"
  | "ready"
  | "error";

type Options = {
  apiKeys: ProviderKeys;
  captureTarget: () => VoiceDraftTarget | null;
  insertTranscript: (target: VoiceDraftTarget, transcript: string) => boolean;
  executeSpaceCommand: (command: SpaceCommand) => Promise<void>;
};

const READY_DURATION_MS = 2_800;

function messageFor(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Voice transcript insertion failed. Try again.";
}

export function useVoicePromptAgent({
  apiKeys,
  captureTarget,
  insertTranscript,
  executeSpaceCommand,
}: Options) {
  const speechToTextModelId = usePreferencesStore(
    (state) => state.speechToTextModelId,
  );
  const [phase, setPhase] = useState<
    "idle" | "refining" | "ready" | "error"
  >(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const targetRef = useRef<VoiceDraftTarget | null>(null);
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
      const spaceCommand = parseSpaceCommand(transcript);
      if (spaceCommand) {
        setPhase("refining");
        setMessage("Space is starting music…");
        try {
          await executeSpaceCommand(spaceCommand);
          setPhase("ready");
          setMessage("Music is playing.");
          clearLater();
        } catch (error) {
          setError(messageFor(error));
        }
        return;
      }

      const target = targetRef.current;
      if (!target) {
        setError("The target terminal is no longer available.");
        return;
      }

      setPhase("refining");
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
    [clearLater, executeSpaceCommand, insertTranscript, setError],
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
    if (recorder.transcribing || phase === "refining") return;
    if (!recorder.supported) {
      setError("Voice recording is not supported in this window.");
      return;
    }
    targetRef.current = captureTarget();
    if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
    setPhase("idle");
    setMessage(null);
    await recorder.start();
  }, [captureTarget, phase, recorder, setError]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  const status: VoiceAgentStatus = recorder.recording
    ? "listening"
    : recorder.transcribing
      ? "transcribing"
      : phase;

  return { status, message, toggle, audioLevel: recorder.audioLevel };
}
