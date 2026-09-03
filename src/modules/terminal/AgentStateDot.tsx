import { cn } from "@/lib/utils";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Spinner } from "@/components/ui/spinner";

export type AgentDisplayState = "blocked" | "done" | "working" | "activity";

const DOT_META: Record<AgentDisplayState, { color: string; label: string }> = {
  blocked: { color: "bg-[#F14C4C]", label: "Blocked — needs your input" },
  done: { color: "bg-[#23D18B]", label: "Done — finished while you were away" },
  working: { color: "bg-primary", label: "Working" },
  activity: { color: "bg-primary", label: "Working" },
};

export function AgentStateDot({
  state,
  className,
}: {
  state: AgentDisplayState;
  className?: string;
}) {
  const meta = DOT_META[state];
  if (state === "working" || state === "activity") {
    return <Spinner className={className} aria-label={meta.label} title={meta.label} />;
  }
  if (state === "done") {
    return (
      <span aria-label={meta.label} title={meta.label} role="status" className={cn("inline-flex size-3 shrink-0 items-center justify-center text-emerald-500", className)}>
        <HugeiconsIcon icon={Tick02Icon} size={11} strokeWidth={2.6} />
      </span>
    );
  }
  return (
    <span
      aria-label={meta.label}
      title={meta.label}
      className={cn("h-2 w-2 shrink-0 rounded-full", meta.color, className)}
    />
  );
}
