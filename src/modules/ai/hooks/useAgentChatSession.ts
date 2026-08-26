import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyAgentChatEvent,
  buildAgentChatReplayPrompt,
  createAgentChatTimeline,
  setAgentChatRuntimeSession,
  submitAgentChatPrompt,
  type AgentChatTimelineState,
} from "../lib/agentChatTimeline";
import { createAgentChatRuntime } from "../lib/agentChatRuntime";
import { loadAgentChatHistory, saveAgentChatHistory } from "../lib/agentChatHistory";

export function useAgentChatSession(input: {
  provider: string;
  workspaceId: string;
  cwd: string;
  initialRuntimeSessionId: string | null;
  initialNativeSessionId: string | null;
  onNativeSessionId: (nativeSessionId: string) => void;
}) {
  const [timeline, setTimeline] = useState<AgentChatTimelineState>(() =>
    createAgentChatTimeline(input.initialRuntimeSessionId, input.initialNativeSessionId),
  );
  const [hydrated, setHydrated] = useState(false);
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const submitInFlightRef = useRef(false);
  const nativeSessionIdRef = useRef(input.initialNativeSessionId);
  nativeSessionIdRef.current = timeline.nativeSessionId;
  const onNativeSessionIdRef = useRef(input.onNativeSessionId);
  onNativeSessionIdRef.current = input.onNativeSessionId;
  const runtimeRef = useRef<ReturnType<typeof createAgentChatRuntime> | null>(null);
  if (runtimeRef.current === null) {
    runtimeRef.current = createAgentChatRuntime((event) => {
      setTimeline((current) => {
        const next = applyAgentChatEvent(current, event);
        timelineRef.current = next;
        return next;
      });
    });
  }
  const runtimeSessionIdRef = useRef(timeline.runtimeSessionId);
  runtimeSessionIdRef.current = timeline.runtimeSessionId;
  const notifiedNativeSessionIdRef = useRef(input.initialNativeSessionId);

  useEffect(() => {
    if (
      timeline.nativeSessionId &&
      timeline.nativeSessionId !== notifiedNativeSessionIdRef.current
    ) {
      notifiedNativeSessionIdRef.current = timeline.nativeSessionId;
      onNativeSessionIdRef.current(timeline.nativeSessionId);
    }
  }, [timeline.nativeSessionId]);

  useEffect(() => {
    let cancelled = false;
    const nativeSessionIdAtLoad = input.initialNativeSessionId;
    void loadAgentChatHistory(input.workspaceId)
      .then((saved) => {
        if (cancelled || !saved) return;
        setTimeline((current) => {
          const next = {
            ...saved,
            runtimeSessionId: current.runtimeSessionId,
            nativeSessionId: nativeSessionIdAtLoad ?? saved.nativeSessionId,
            status: "idle" as const,
          };
          timelineRef.current = next;
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [input.workspaceId]);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(() => {
      void saveAgentChatHistory(input.workspaceId, timelineRef.current);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [hydrated, input.workspaceId, timeline]);

  const submit = useCallback(
    async (rawPrompt: string, model?: string) => {
      const prompt = rawPrompt.trim();
      const current = timelineRef.current;
      if (!hydrated || !prompt || current.status === "running" || submitInFlightRef.current) return false;
      const runtimePrompt =
        input.provider === "claude" && !runtimeSessionIdRef.current
          ? buildAgentChatReplayPrompt(current, prompt)
          : prompt;
      submitInFlightRef.current = true;
      const submitted = submitAgentChatPrompt(current, prompt);
      timelineRef.current = submitted;
      setTimeline(submitted);
      try {
        if (runtimeSessionIdRef.current) {
          await runtimeRef.current!.send(runtimeSessionIdRef.current, runtimePrompt, model);
        } else {
          const result = await runtimeRef.current!.start({
            provider: input.provider,
            cwd: input.cwd,
            prompt: runtimePrompt,
            model,
            nativeSessionId: nativeSessionIdRef.current,
          });
          runtimeSessionIdRef.current = result.sessionId;
          setTimeline((currentTimeline) => {
            const next = setAgentChatRuntimeSession(currentTimeline, result.sessionId);
            timelineRef.current = next;
            return next;
          });
        }
        return true;
      } catch (error) {
        setTimeline((currentTimeline) => {
          const next = applyAgentChatEvent(currentTimeline, {
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
          timelineRef.current = next;
          return next;
        });
        return false;
      } finally {
        submitInFlightRef.current = false;
      }
    },
    [hydrated, input.cwd, input.provider],
  );

  const cancel = useCallback(async () => {
    if (!timeline.runtimeSessionId) return;
    await runtimeRef.current!.cancel(timeline.runtimeSessionId);
  }, [timeline.runtimeSessionId]);

  useEffect(() => {
    return () => {
      if (runtimeSessionIdRef.current) {
        void runtimeRef.current?.close(runtimeSessionIdRef.current);
      }
    };
  }, []);

  return { timeline, submit, cancel, hydrated };
}
