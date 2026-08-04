import { useCallback, useEffect, useRef, useState } from "react";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { generateVoicePrompt } from "../lib/voicePrompt";
import {
  loadVoicePromptHistory,
  saveVoicePromptHistory,
} from "../lib/voicePromptHistory";
import { useChatStore } from "../store/chatStore";
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
  | "clarification"
  | "error";

type Options = {
  captureTarget: () => VoiceDraftTarget | null;
  insertDraft: (target: VoiceDraftTarget, draft: string) => boolean;
};

const READY_DURATION_MS = 2_800;

function messageFor(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Voice prompt generation failed. Try again.";
}

export function useVoicePromptAgent({ captureTarget, insertDraft }: Options) {
  const modelId = useChatStore((state) => state.selectedModelId);
  const keys = useChatStore((state) => state.apiKeys);
  const speechToTextModelId = usePreferencesStore(
    (state) => state.speechToTextModelId,
  );
  const [phase, setPhase] = useState<
    "idle" | "refining" | "ready" | "clarification" | "error"
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

  const refineTranscript = useCallback(
    async (transcript: string) => {
      const target = targetRef.current;
      if (!target) {
        setError("The target terminal is no longer available.");
        return;
      }

      setPhase("refining");
      setMessage("Refining request…");
      try {
        const preferences = usePreferencesStore.getState();
        const historyScope = `${target.kind}:${target.tabId}:${target.terminalId}`;
        const recentDrafts = (await loadVoicePromptHistory(historyScope)).map(
          (entry) => entry.text,
        );
        const result = await generateVoicePrompt({
          transcript,
          cwd: target.cwd,
          terminalContext: target.terminalContext,
          recentDrafts,
          modelId,
          keys,
          local: {
            lmstudioBaseURL: preferences.lmstudioBaseURL,
            lmstudioModelId: preferences.lmstudioModelId,
            mlxBaseURL: preferences.mlxBaseURL,
            mlxModelId: preferences.mlxModelId,
            ollamaBaseURL: preferences.ollamaBaseURL,
            ollamaModelId: preferences.ollamaModelId,
            openaiCompatibleBaseURL: preferences.openaiCompatibleBaseURL,
            openaiCompatibleModelId: preferences.openaiCompatibleModelId,
          },
        });
        if (result.kind === "clarification") {
          setPhase("clarification");
          setMessage(result.text);
          clearLater();
          return;
        }
        if (result.kind === "ship" || result.kind === "scout") {
          if (!insertDraft(target, result.text)) {
            throw new Error(
              "The terminal is busy. Wait for the command to finish, then try again.",
            );
          }
          await saveVoicePromptHistory(historyScope, result);
          setPhase("ready");
          setMessage(
            result.kind === "ship"
              ? "Task ready — review, then press Enter."
              : "Investigation ready — review, then press Enter.",
          );
          clearLater();
          return;
        }

        throw new Error("Voice task compilation returned an unsupported task kind.");
      } catch (error) {
        setError(messageFor(error));
      }
    },
    [clearLater, insertDraft, keys, modelId, setError],
  );

  const recorder = useWhisperRecording({
    onResult: refineTranscript,
    onError: setError,
    speechToTextModelId,
    apiKeys: keys,
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
    const target = captureTarget();
    if (!target) {
      setError("Select a non-private terminal pane before starting voice input.");
      return;
    }
    targetRef.current = target;
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
