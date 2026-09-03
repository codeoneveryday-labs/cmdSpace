export type UsagePercentTone = "ok" | "warning" | "critical";

export function usagePercentTone(usedPercent: number): UsagePercentTone {
  if (usedPercent >= 90) return "critical";
  if (usedPercent >= 50) return "warning";
  return "ok";
}

export function clampUsagePercent(usedPercent: number): number {
  if (!Number.isFinite(usedPercent)) return 0;
  return Math.min(100, Math.max(0, Math.round(usedPercent)));
}

export const USAGE_BAR_TONE_CLASS: Record<UsagePercentTone, string> = {
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

export const USAGE_TEXT_TONE_CLASS: Record<UsagePercentTone, string> = {
  ok: "text-emerald-500",
  warning: "text-amber-500",
  critical: "text-red-500",
};
