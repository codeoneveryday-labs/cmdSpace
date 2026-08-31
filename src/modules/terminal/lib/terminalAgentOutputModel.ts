export type AgentOutputActivityDecision =
  | { kind: "blocked" }
  | { kind: "working" }
  | { kind: "quiet" }
  | { kind: "ignore" };

export function resolveAgentOutputActivity({
  responseRequested,
  spinnerState,
  outputIsUserEcho,
}: {
  responseRequested: boolean;
  spinnerState: "blocked" | "working" | "idle" | null;
  outputIsUserEcho: boolean;
}): AgentOutputActivityDecision {
  if (!responseRequested || outputIsUserEcho) return { kind: "ignore" };
  if (spinnerState === "blocked") return { kind: "blocked" };
  if (spinnerState === "working") return { kind: "working" };
  return { kind: "quiet" };
}
