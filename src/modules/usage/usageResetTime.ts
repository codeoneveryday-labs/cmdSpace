/**
 * Shared usage-window and reset-time formatting.
 *
 * A bare window length ("168h") or a bare clock time ("09:25") never tells
 * the user when a weekly limit actually resets, so weekly-scale UI always
 * carries a calendar date ("7d", "10 Sep, 09:25").
 */

export function formatUsageWindow(minutes: number): string {
  if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function toResetDate(timestamp: number): Date | null {
  if (!timestamp) return null;
  const reset = new Date(timestamp * 1000);
  return Number.isNaN(reset.getTime()) ? null : reset;
}

/** Full reset stamp: "10 Sep, 09:25". Empty when unknown. */
export function formatResetDateTime(timestamp?: number): string {
  const reset = timestamp === undefined ? null : toResetDate(timestamp);
  if (!reset) return "";
  // Built manually (not a single toLocaleString) so the order stays
  // "day month, 24h time" regardless of the OS locale.
  const month = reset.toLocaleString([], { month: "short" });
  const time = reset.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${reset.getDate()} ${month}, ${time}`;
}

/** Compact weekday for tight surfaces (tray): "Mon". Empty when unknown. */
export function formatResetWeekday(timestamp?: number): string {
  const reset = timestamp === undefined ? null : toResetDate(timestamp);
  if (!reset) return "";
  return reset.toLocaleDateString([], { weekday: "short" });
}
