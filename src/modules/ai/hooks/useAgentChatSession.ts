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
import { createAgentChatStartup } from "../lib/agentChatStartup";

const claimedNativeSessions = new Map<string, string>();

// How long steer waits for the backend's post-interrupt Done before submitting
// anyway (the provider guard then surfaces any readiness error honestly).
const STEER_DONE_TIMEOUT_MS = 5000;

function isMissingAgentChatRuntime(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith("unknown agent chat session '");
}

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
  const historyKeyRef = useRef<string | null>(null);
  const nativeSessionIdRef = useRef(input.initialNativeSessionId);
  nativeSessionIdRef.current = timeline.nativeSessionId;
  const onNativeSessionIdRef = useRef(input.onNativeSessionId);
  onNativeSessionIdRef.current = input.onNativeSessionId;
  const runtimeRef = useRef<ReturnType<typeof createAgentChatRuntime> | null>(null);
  const runtimeEpochRef = useRef(0);
  const doneWaiterRef = useRef<(() => void) | null>(null);
  const createRuntimeForCurrentEpoch = () => {
    const epoch = runtimeEpochRef.current;
    return createAgentChatRuntime((event) => {
      if (epoch !== runtimeEpochRef.current) return;
      if (event.type === "done") {
        doneWaiterRef.current?.();
        doneWaiterRef.current = null;
      }
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
  const startupRef = useRef<{
    key: string;
    startup: ReturnType<typeof createAgentChatStartup>;
  } | null>(null);
  const getStartup = () => {
    const key = `${input.chatId}:${input.provider}:${input.cwd}:${input.initialNativeSessionId ?? "new"}`;
    if (startupRef.current?.key === key) return startupRef.current.startup;
    const nativeSessionId = input.initialNativeSessionId &&
      (!claimedNativeSessions.has(input.initialNativeSessionId) ||
        claimedNativeSessions.get(input.initialNativeSessionId) === input.chatId)
      ? input.initialNativeSessionId
      : null;
    if (nativeSessionId) claimedNativeSessions.set(nativeSessionId, input.chatId);
    const startup = createAgentChatStartup({
      runtime: runtimeRef.current!,
      chatId: input.chatId,
      provider: input.provider,
      cwd: input.cwd,
      nativeSessionId,
    });
    startupRef.current = { key, startup };
    return startup;
  };
  const runtimeSessionIdRef = useRef(timeline.runtimeSessionId);
  runtimeSessionIdRef.current = timeline.runtimeSessionId;
  const attachmentRef = useRef<{
    sessionId: string;
    attachmentToken: string;
  } | null>(null);
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
    if (
      !hydrated ||
      !input.active ||
      attachmentRef.current
    ) {
      return;
    }

    let cancelled = false;
    const runtime = runtimeRef.current!;
    void getStartup()
      .attachResident()
      .then((result) => {
        if (cancelled) {
          void runtime.detach(input.chatId, result.sessionId, result.attachmentToken);
          return;
        }
        attachmentRef.current = {
          sessionId: result.sessionId,
          attachmentToken: result.attachmentToken,
        };
        runtimeSessionIdRef.current = result.sessionId;
        setTimeline((current) => {
          const next = setAgentChatRuntimeSession(current, result.sessionId);
          timelineRef.current = next;
          return next;
        });
      })
      .catch(() => undefined);

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
          try {
            await runtimeRef.current!.send(runtimeSessionIdRef.current, runtimePrompt, model);
          } catch (error) {
            if (!isMissingAgentChatRuntime(error)) throw error;
            attachmentRef.current = null;
            runtimeSessionIdRef.current = null;
            setTimeline((currentTimeline) => {
              const next = { ...currentTimeline, runtimeSessionId: null };
              timelineRef.current = next;
              return next;
            });
            const result = await getStartup().recoverFirstPrompt(runtimePrompt, model);
            attachmentRef.current = {
              sessionId: result.sessionId,
              attachmentToken: result.attachmentToken,
            };
            runtimeSessionIdRef.current = result.sessionId;
            setTimeline((currentTimeline) => {
              const next = setAgentChatRuntimeSession(currentTimeline, result.sessionId);
              timelineRef.current = next;
              return next;
            });
            if (!result.started) {
              await runtimeRef.current!.send(result.sessionId, runtimePrompt, model);
            }
          }
        } else {
          const result = await getStartup().admitFirstPrompt(runtimePrompt, model);
          attachmentRef.current = {
            sessionId: result.sessionId,
            attachmentToken: result.attachmentToken,
          };
          runtimeSessionIdRef.current = result.sessionId;
          setTimeline((currentTimeline) => {
            const next = setAgentChatRuntimeSession(currentTimeline, result.sessionId);
            timelineRef.current = next;
            return next;
          });
          if (!result.started) {
            await runtimeRef.current!.send(result.sessionId, runtimePrompt, model);
          }
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
    [hydrated, input.chatId, input.cwd, input.initialNativeSessionId, input.provider],
  );

  // Interrupting a turn must not tear the resident runtime down: the backend
  // emits Done once the turn aborts (interrupt or child kill) and the session
  // stays attached for the next prompt. Only rewrite (branch reset) closes it.
  const cancel = useCallback(async () => {
    const runtimeSessionId = runtimeSessionIdRef.current;
    if (!runtimeSessionId) return;
    await runtimeRef.current!.cancel(runtimeSessionId).catch(() => undefined);
    setTimeline((current) => {
      const next = applyAgentChatEvent(current, { type: "done" });
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
      if (!runtimeSessionIdRef.current) {
        return submit(rawPrompt, model, displayText, attachments);
      }
      let resolveTurnEnded: (() => void) | null = null;
      const turnEnded = new Promise<void>((resolve) => {
        resolveTurnEnded = resolve;
      });
      doneWaiterRef.current = () => resolveTurnEnded?.();
      const pending = { rawPrompt, model, displayText, attachments };
      try {
        await cancel();
        await Promise.race([
          turnEnded,
          new Promise((resolve) => setTimeout(resolve, STEER_DONE_TIMEOUT_MS)),
        ]);
      } finally {
        doneWaiterRef.current = null;
      }
      return submit(pending.rawPrompt, pending.model, pending.displayText, pending.attachments);
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
      // A rewritten branch must not resume the native session that still
      // contains the abandoned branch, so unlike cancel/steer the runtime is
      // fully closed and replaced before replaying the truncated prompt.
      const runtimeSessionId = runtimeSessionIdRef.current;
      await cancel();
      if (runtimeSessionId) {
        attachmentRef.current = null;
        await runtimeRef.current!.close(runtimeSessionId).catch(() => undefined);
      }
      runtimeEpochRef.current += 1;
      runtimeRef.current = createRuntimeForCurrentEpoch();
      startupRef.current = null;
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
      const attachment = attachmentRef.current;
      if (attachment) {
        void runtimeRef.current?.detach(
          input.chatId,
          attachment.sessionId,
          attachment.attachmentToken,
        );
      }
    };
  }, []);

  return { timeline, submit, cancel, steer, rewriteFromPrompt, hydrated };
}
