import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  avoidNativeBrowserBounds,
  readNativeBrowserBounds,
  rectsOverlap,
  subscribeNativeBrowserBounds,
} from "@/modules/preview/nativeBrowserBounds";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  useSpeechToTextInput,
  type SpeechInputStatus,
  type SpeechInputTarget,
} from "../hooks/useVoicePromptAgent";
import type { ProviderKeys } from "../lib/keyring";

export type { SpeechInputTarget } from "../hooks/useVoicePromptAgent";

export type FloatingVoiceAgentHandle = { toggle: () => void };

type Props = {
  apiKeys: ProviderKeys;
  captureTarget: () => SpeechInputTarget | null;
  captureVocabulary: () => Promise<string>;
  insertTranscript: (target: SpeechInputTarget, transcript: string) => boolean;
};

const LABELS: Record<SpeechInputStatus, string> = {
  idle: "Voice input",
  listening: "Listening",
  transcribing: "Transcribing",
  inserting: "Inserting transcript",
  ready: "Transcript inserted",
  error: "Voice input unavailable",
};

const WAVEFORM_WEIGHTS = [0.55, 0.8, 1, 0.8, 0.55];
const VOICE_DRAG_THRESHOLD_PX = 4;
const VOICE_SCREEN_EDGE_PX = 12;

export const FloatingVoiceAgent = forwardRef<FloatingVoiceAgentHandle, Props>(
  function FloatingVoiceAgent(
    { apiKeys, captureTarget, captureVocabulary, insertTranscript },
    ref,
  ) {
    const enabled = usePreferencesStore((state) => state.floatingVoiceAgentEnabled);
    const { status, message, toggle, audioLevel } = useSpeechToTextInput({
      apiKeys,
      captureTarget,
      captureVocabulary,
      insertTranscript,
    });
    const label = status === "error" ? message ?? LABELS[status] : LABELS[status];
    const visibleLabel = status === "error" ? "…" : LABELS[status];
    const isListening = status === "listening";
    const voiceInputGlow = isListening
      ? `0 0 ${10 + audioLevel * 26}px rgb(251 146 60 / ${0.2 + audioLevel * 0.48}), 0 -${2 + audioLevel * 8}px ${8 + audioLevel * 20}px rgb(239 68 68 / ${0.12 + audioLevel * 0.3})`
      : undefined;
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
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const positionRef = useRef(position);
    positionRef.current = position;

    useImperativeHandle(ref, () => ({ toggle }), [toggle]);

    // External URLs render in a native child webview above all DOM, so the
    // pill steers around published browser rects instead of sliding under.
    const resolveVisiblePosition = (
      left: number,
      top: number,
      width: number,
      height: number,
    ) => {
      const viewportClamped = {
        left: Math.min(
          Math.max(VOICE_SCREEN_EDGE_PX, left),
          window.innerWidth - width - VOICE_SCREEN_EDGE_PX,
        ),
        top: Math.min(
          Math.max(VOICE_SCREEN_EDGE_PX, top),
          window.innerHeight - height - VOICE_SCREEN_EDGE_PX,
        ),
      };
      const avoided = avoidNativeBrowserBounds(
        viewportClamped,
        { width, height },
        readNativeBrowserBounds(),
      );
      return {
        left: Math.min(
          Math.max(VOICE_SCREEN_EDGE_PX, avoided.left),
          window.innerWidth - width - VOICE_SCREEN_EDGE_PX,
        ),
        top: Math.min(
          Math.max(VOICE_SCREEN_EDGE_PX, avoided.top),
          window.innerHeight - height - VOICE_SCREEN_EDGE_PX,
        ),
      };
    };

    // Re-clamp the parked pill when browser bounds change underneath it
    // (sidebar resize, collapse, navigation). Re-runs when `enabled` flips:
    // preferences hydrate async, so the button often mounts after the first
    // bounds publish — without this the pill parks under the browser.
    useEffect(() => {
      if (!enabled) return undefined;
      const reclamp = () => {
        const button = buttonRef.current;
        if (!button) return;
        const current = positionRef.current;
        const rect = current
          ? {
              left: current.left,
              top: current.top,
              width: button.offsetWidth,
              height: button.offsetHeight,
            }
          : button.getBoundingClientRect();
        const obstacles = readNativeBrowserBounds();
        if (!obstacles.some((bounds) => rectsOverlap(rect, bounds))) return;
        const next = resolveVisiblePosition(
          rect.left,
          rect.top,
          button.offsetWidth,
          button.offsetHeight,
        );
        if (
          !current ||
          next.left !== current.left ||
          next.top !== current.top
        ) {
          setPosition(next);
        }
      };
      reclamp();
      return subscribeNativeBrowserBounds(reclamp);
    }, [enabled]);

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
      setPosition(
        resolveVisiblePosition(
          drag.originLeft + deltaX,
          drag.originTop + deltaY,
          offsetWidth,
          offsetHeight,
        ),
      );
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
        ref={buttonRef}
        aria-label="Toggle voice input"
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
          "fixed bottom-5 right-5 z-[90] inline-flex h-10 max-w-[min(420px,calc(100vw-24px))] touch-none select-none items-center gap-2 overflow-hidden rounded-full border border-border/80 bg-background/95 px-2.5 pr-3 text-xs font-semibold shadow-lg shadow-black/15 ring-1 ring-border/45 ring-offset-2 ring-offset-background/80 backdrop-blur-md transition-[box-shadow,color,border-color,background-color] duration-100 ease-out motion-reduce:transition-none cursor-grab dark:border-zinc-700/80 dark:bg-zinc-950/95 dark:text-zinc-200 dark:shadow-black/40 dark:ring-zinc-800/70 dark:ring-offset-zinc-950/80",
          dragging && "cursor-grabbing",
          status === "listening" && "border-primary/60 bg-primary/10 text-primary",
          status === "ready" && "border-emerald-500/50 text-emerald-600 dark:text-emerald-300",
          status === "error" && "border-destructive/40 bg-destructive/[0.06] text-destructive dark:border-red-400/25 dark:bg-red-950/25 dark:text-red-300",
        )}
        style={{
          ...(position ? { ...position, right: "auto", bottom: "auto" } : {}),
          boxShadow: voiceInputGlow,
        }}
      >
        <span className="size-5 shrink-0 overflow-hidden rounded-full" aria-hidden="true">
          <img
            src="/logo-light.png"
            alt=""
            draggable={false}
            className="size-full rounded-full object-cover dark:hidden"
          />
          <img
            src="/logo.png"
            alt=""
            draggable={false}
            className="hidden size-full rounded-full object-cover invert dark:block"
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
