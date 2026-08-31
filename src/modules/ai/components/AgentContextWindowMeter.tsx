import type { AgentUsageStatus } from "@/modules/terminal/lib/terminal-native";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return Math.round(value).toString();
}

export function AgentContextWindowMeter({
  usage,
}: {
  usage: AgentUsageStatus | null;
}) {
  const contextWindow = usage?.contextWindow;
  const contextTokens = usage?.contextTokens;
  const percentage = contextWindow && contextTokens !== undefined
    ? Math.min(100, Math.max(0, (contextTokens / contextWindow) * 100))
    : null;
  const circumference = 2 * Math.PI * 8;
  const dashOffset = percentage === null ? circumference : circumference * (1 - percentage / 100);
  const color = percentage !== null && percentage > 90
    ? "rgb(239 68 68)"
    : percentage !== null && percentage >= 70
      ? "rgb(245 158 11)"
      : "currentColor";
  const title = percentage === null
    ? "Context window unavailable from this CLI"
    : `Context window: ${formatTokenCount(contextTokens!)} of ${formatTokenCount(contextWindow!)} tokens${usage?.contextIsEstimated ? " (estimated)" : ""}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label={title}>
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" className="-rotate-90">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.22" />
            <circle cx="10" cy="10" r="8" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} className="transition-[stroke-dashoffset,stroke] duration-300" />
          </svg>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="block min-w-44 px-3 py-2 text-[11px] leading-5">
        <p className="font-medium">Context window</p>
        {percentage === null ? <p className="text-background/70">Unavailable from this CLI</p> : <><p>{Math.round(percentage)}% used</p><p className="text-background/70">{formatTokenCount(contextTokens!)} / {formatTokenCount(contextWindow!)} tokens{usage?.contextIsEstimated ? " · estimated" : ""}</p></>}
      </TooltipContent>
    </Tooltip>
  );
}
