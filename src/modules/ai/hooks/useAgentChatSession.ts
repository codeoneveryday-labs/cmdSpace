import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyAgentChatEvent,
  createAgentChatTimeline,
  buildAgentChatReplayPrompt,
  setAgentChatRuntimeSession,
  submitAgentChatPrompt,
  type AgentChatHistoryAttachment,
  type AgentChatTimelineState,
} from "../lib/agentChatTimeline";
import { createAgentChatRuntime } from "../lib/agentChatRuntime";

const claimedNativeSessions = new Map<string, string>();

export function useAgentChatSession(input: {
  provider: string;
  chatId: string;
  active: boolean;
  workspaceId: string;
  cwd: string;
  initialRuntimeSessionId: string | null;
  initialNativeSessionId: string | null;
  onNativeSessionId: (nativeSessionId: string) => void;
}) {
  const [timeline, setTimeline] = useState<AgentChatTimelineState>(() =>
    createAgentChatTimeline(input.initialRuntimeSessionId, input.initialNativeSessionId),
  );
  // The native CLI session is the source of truth for conversation history.
  // This hook only projects live structured events into the current view.
  const [hydrated] = useState(true);
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const submitInFlightRef = useRef(false);
  const bootstrapKeyRef = useRef<string | null>(null);
  const historyKeyRef = useRef<string | null>(null);
  const nativeSessionIdRef = useRef(input.initialNativeSessionId);
  nativeSessionIdRef.current = timeline.nativeSessionId;
  const onNativeSessionIdRef = useRef(input.onNativeSessionId);
  onNativeSessionIdRef.current = input.onNativeSessionId;
  const runtimeRef = useRef<ReturnType<typeof createAgentChatRuntime> | null>(null);
  const runtimeEpochRef = useRef(0);
  const createRuntimeForCurrentEpoch = () => {
    const epoch = runtimeEpochRef.current;
    return createAgentChatRuntime((event) => {
      if (epoch !== runtimeEpochRef.current) return;
      setTimeline((current) => {
        const next = applyAgentChatEvent(current, event);
        timelineRef.current = next;
        return next;
      });
    });
  };
  if (runtimeRef.current === null) {
    runtimeRef.current = createRuntimeForCurrentEpoch();
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
    const bootstrapKey = `${input.provider}:${input.cwd}:${input.initialNativeSessionId ?? "new"}`;
    if (
      !hydrated ||
      !input.active ||
      (input.provider === "cmd" || input.provider === "claude") ||
      runtimeSessionIdRef.current ||
      submitInFlightRef.current ||
      bootstrapKeyRef.current === bootstrapKey
    ) {
      return;
    }

    let cancelled = false;
    const nativeSessionId = input.initialNativeSessionId &&
      (!claimedNativeSessions.has(input.initialNativeSessionId) ||
        claimedNativeSessions.get(input.initialNativeSessionId) === input.chatId)
      ? input.initialNativeSessionId
      : null;
    if (nativeSessionId) claimedNativeSessions.set(nativeSessionId, input.chatId);
    bootstrapKeyRef.current = bootstrapKey;
    submitInFlightRef.current = true;
    void runtimeRef.current!
      .start({
        provider: input.provider,
        cwd: input.cwd,
        prompt: "",
        nativeSessionId,
      })
      .then((result) => {
        if (cancelled) return;
        runtimeSessionIdRef.current = result.sessionId;
        setTimeline((current) => {
          const next = setAgentChatRuntimeSession(current, result.sessionId);
          timelineRef.current = next;
          return next;
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setTimeline((current) => {
          const next = applyAgentChatEvent(current, {
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
          timelineRef.current = next;
          return next;
        });
      })
      .finally(() => {
        submitInFlightRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, input.active, input.chatId, input.cwd, input.initialNativeSessionId, input.provider]);

  useEffect(() => {
    const historyKey = `${input.provider}:${input.cwd}:${input.initialNativeSessionId ?? ""}`;
    if (
      !hydrated ||
      !input.active ||
      (input.provider !== "codex" && input.provider !== "cmd" && input.provider !== "claude") ||
      !input.initialNativeSessionId ||
      (input.provider !== "cmd" && input.provider !== "claude" &&
        claimedNativeSessions.get(input.initialNativeSessionId) !== input.chatId) ||
      historyKeyRef.current === historyKey
    ) return;
    let cancelled = false;
    historyKeyRef.current = historyKey;
    void runtimeRef.current!
      .loadHistory(input.provider, input.cwd, input.initialNativeSessionId)
      .then((events) => {
        if (cancelled) return;
        setTimeline((current) => {
          if (current.items.length > 0) return current;
          const next = events.reduce(applyAgentChatEvent, current);
          timelineRef.current = next;
          return next;
        });
      })
      .catch(() => {
        // Resume remains authoritative; an unavailable transcript should not
        // prevent the native session from being reopened.
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, input.active, input.chatId, input.cwd, input.initialNativeSessionId, input.provider]);

  const submit = useCallback(
    async (
      rawPrompt: string,
      model?: string,
      displayText = rawPrompt,
      attachments: AgentChatHistoryAttachment[] = [],
    ) => {
      const prompt = rawPrompt.trim();
      const current = timelineRef.current;
      if (!hydrated || !prompt || current.status === "running" || submitInFlightRef.current) return false;
      const runtimePrompt = prompt;
      submitInFlightRef.current = true;
      const submitted = submitAgentChatPrompt(current, displayText.trim(), attachments);
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
    const runtimeSessionId = runtimeSessionIdRef.current;
    if (!runtimeSessionId) return;
    await runtimeRef.current!.cancel(runtimeSessionId).catch(() => undefined);
    await runtimeRef.current!.close(runtimeSessionId).catch(() => undefined);
    runtimeEpochRef.current += 1;
    runtimeRef.current = createRuntimeForCurrentEpoch();
    runtimeSessionIdRef.current = null;
    setTimeline((current) => {
      const next = {
        ...applyAgentChatEvent(current, { type: "done" }),
        runtimeSessionId: null,
      };
      timelineRef.current = next;
      return next;
    });
  }, []);

  const steer = useCallback(
    async (
      rawPrompt: string,
      model?: string,
      displayText = rawPrompt,
      attachments: AgentChatHistoryAttachment[] = [],
    ) => {
      await cancel();
      return submit(rawPrompt, model, displayText, attachments);
    },
    [cancel, submit],
  );

  const rewriteFromPrompt = useCallback(
    async (itemId: string, rawPrompt: string, model?: string) => {
      const prompt = rawPrompt.trim();
      const current = timelineRef.current;
      const itemIndex = current.items.findIndex((candidate) => candidate.id === itemId);
      const item = current.items[itemIndex];
      if (!prompt || item?.kind !== "user" || itemIndex < 0) return false;
      await cancel();
      const base = {
        ...timelineRef.current,
        runtimeSessionId: null,
        nativeSessionId: null,
        status: "idle" as const,
        error: null,
        turnStartedAt: null,
        items: timelineRef.current.items.slice(0, itemIndex),
      };
      nativeSessionIdRef.current = null;
      runtimeSessionIdRef.current = null;
      timelineRef.current = base;
      setTimeline(base);
      const replayPrompt = buildAgentChatReplayPrompt(base, prompt);
      return submit(replayPrompt, model, prompt);
    },
    [cancel, input.cwd, input.provider],
  );

  useEffect(() => {
    return () => {
      if (runtimeSessionIdRef.current) {
        void runtimeRef.current?.close(runtimeSessionIdRef.current);
      }
    };
  }, []);

  return { timeline, submit, cancel, steer, rewriteFromPrompt, hydrated };
}
