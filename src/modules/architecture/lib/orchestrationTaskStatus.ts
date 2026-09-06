import type { AgentDisplayState } from "@/modules/terminal/AgentStateDot";

/**
 * Map an orchestration task status onto a terminal header dot. Quiet states
 * (queued, draft, cancelled, interrupted) show no dot — the node chrome
 * stays clean until the task needs attention or is done.
 */
export function taskStatusDot(status: string): AgentDisplayState | null {
  switch (status) {
    case "running":
    case "validating":
      return "working";
    case "completed":
      return "done";
    case "failed":
    case "blocked":
      return "blocked";
    default:
      return null;
  }
}
