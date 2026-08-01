import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  useVoicePromptAgent,
  type VoiceAgentStatus,
  type VoiceDraftTarget,
} from "../hooks/useVoicePromptAgent";

export type { VoiceDraftTarget } from "../hooks/useVoicePromptAgent";

export type FloatingVoiceAgentHandle = { toggle: () => void };

type Props = {
  captureTarget: () => VoiceDraftTarget | null;
  insertDraft: (target: VoiceDraftTarget, draft: string) => boolean;
};

const LABELS: Record<VoiceAgentStatus, string> = {
  idle: "Voice",
  listening: "Listening",
  transcribing: "Transcribing",
  refining: "Refining",
  ready: "Task ready",
  clarification: "Need details",
  error: "Voice unavailable",
};

const WAVEFORM_WEIGHTS = [0.55, 0.8, 1, 0.8, 0.55];
const VOICE_DRAG_THRESHOLD_PX = 4;
const VOICE_SCREEN_EDGE_PX = 12;

export const FloatingVoiceAgent = forwardRef<FloatingVoiceAgentHandle, Props>(
  function FloatingVoiceAgent({ captureTarget, insertDraft }, ref) {
    const enabled = usePreferencesStore((state) => state.floatingVoiceAgentEnabled);
    const { status, message, toggle, audioLevel } = useVoicePromptAgent({
      captureTarget,
      insertDraft,
    });
    const label =
      status === "error" || status === "clarification"
        ? message ?? LABELS[status]
        : LABELS[status];
    const visibleLabel =
      status === "error" ? "…" : status === "clarification" ? label : LABELS[status];
    const isListening = status === "listening";
    const dragRef = useRef<{
      pointerId: number;
      startX: number;
      startY: number;
      originLeft: number;
      originTop: number;
      moved: boolean;
    } | null>(null);
    const suppressClickRef = useRef(false);
    const [dragging, setDragging] = useState(false);
    const [position, setPosition] = useState<{ left: number; top: number } | null>(
      null,
    );

    useImperativeHandle(ref, () => ({ toggle }), [toggle]);

    const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originLeft: rect.left,
        originTop: rect.top,
        moved: false,
      };
      suppressClickRef.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
    };

    const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (
        !drag.moved &&
        Math.hypot(deltaX, deltaY) < VOICE_DRAG_THRESHOLD_PX
      ) {
        return;
      }

      drag.moved = true;
      suppressClickRef.current = true;
      setDragging(true);
      const { offsetWidth, offsetHeight } = event.currentTarget;
      setPosition({
        left: Math.min(
          Math.max(VOICE_SCREEN_EDGE_PX, drag.originLeft + deltaX),
          window.innerWidth - offsetWidth - VOICE_SCREEN_EDGE_PX,
        ),
        top: Math.min(
          Math.max(VOICE_SCREEN_EDGE_PX, drag.originTop + deltaY),
          window.innerHeight - offsetHeight - VOICE_SCREEN_EDGE_PX,
        ),
      });
    };

    const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (drag.moved) suppressClickRef.current = true;
      dragRef.current = null;
      setDragging(false);
    };

    if (!enabled) return null;

    return (
      <button
        type="button"
        aria-label="Toggle Voice Agent"
        aria-pressed={status === "listening"}
        title={label}
        onPointerDown={startDrag}
        onPointerMove={move}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          void toggle();
        }}
        className={cn(
          "fixed bottom-5 right-5 z-[90] inline-flex h-10 max-w-[min(420px,calc(100vw-24px))] touch-none select-none items-center gap-2 overflow-hidden rounded-full border border-border/80 bg-background/95 px-2.5 pr-3 text-xs font-semibold shadow-lg shadow-black/15 ring-1 ring-border/45 ring-offset-2 ring-offset-background/80 backdrop-blur-md transition-colors cursor-grab dark:border-zinc-700/80 dark:bg-zinc-950/95 dark:text-zinc-200 dark:shadow-black/40 dark:ring-zinc-800/70 dark:ring-offset-zinc-950/80",
          dragging && "cursor-grabbing",
          status === "listening" && "border-primary/60 bg-primary/10 text-primary",
          status === "ready" && "border-emerald-500/50 text-emerald-600 dark:text-emerald-300",
          status === "error" && "border-destructive/40 bg-destructive/[0.06] text-destructive dark:border-red-400/25 dark:bg-red-950/25 dark:text-red-300",
        )}
        style={position ? { ...position, right: "auto", bottom: "auto" } : undefined}
      >
        <span className="size-5 shrink-0 overflow-hidden rounded-full" aria-hidden="true">
          <img
            src="/logo.png"
            alt=""
            draggable={false}
            className="size-full rounded-full object-cover"
          />
        </span>
        <span className="flex h-4 shrink-0 items-center gap-0.5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((bar) => (
            <span
              key={bar}
              className={cn(
                "origin-center w-0.5 rounded-full bg-current transition-transform duration-75 ease-out motion-reduce:transition-none",
                isListening ? "opacity-100" : "opacity-65",
              )}
              style={{
                height: `${6 + ((bar + 1) % 3) * 3}px`,
                transform: `scaleY(${isListening ? 0.25 + audioLevel * 0.75 * WAVEFORM_WEIGHTS[bar] : 0.45})`,
              }}
            />
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate whitespace-nowrap">{visibleLabel}</span>
        <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">⌘⇧V</span>
      </button>
    );
  },
);
