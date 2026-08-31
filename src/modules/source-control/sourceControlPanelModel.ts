import type { SourceControlSummary } from "./useSourceControl";

export function deriveSourceControlPanelModel(
  scm: {
    stagedEntries: unknown[];
    commitMessage: string;
    actionBusy: boolean | string | null;
    pushHint?: string | null;
    status?: { upstream?: string | null; behind: number; ahead: number; isDetached: boolean } | null;
    actionError?: string | null;
    remoteError?: string | null;
    actionMessage?: string | null;
  },
  sourceControl: SourceControlSummary,
) {
  const actionBusy = Boolean(scm.actionBusy);
  const hasUpstream = Boolean(scm.status?.upstream);
  const isDiverged = Boolean(scm.status && scm.status.ahead > 0 && scm.status.behind > 0);
  const pushHint = scm.pushHint ?? "Push is unavailable right now.";
  return {
    canCommit:
      scm.stagedEntries.length > 0 &&
      scm.commitMessage.trim().length > 0 &&
      !actionBusy,
    commitDisabledReason: actionBusy
      ? "Wait for the current Git action to finish."
      : scm.stagedEntries.length === 0
        ? "Stage changes to enable commit."
        : scm.commitMessage.trim().length === 0
          ? "Enter a commit message to enable commit."
          : null,
    pushDisabledReason: actionBusy
      ? "Wait for the current Git action to finish."
      : pushHint,
    stagedCount: scm.stagedEntries.length,
    pushStatusLabel: scm.status?.upstream ?? "No upstream",
    hasUpstream,
    isDiverged,
    canPull:
      hasUpstream &&
      Boolean(scm.status) &&
      (scm.status?.behind ?? 0) > 0 &&
      !isDiverged &&
      !actionBusy &&
      !sourceControl.busyAction,
    canFetch: hasUpstream && !actionBusy && !sourceControl.busyAction,
    footerFeedback: scm.actionError
      ? ({ tone: "error", message: scm.actionError } as const)
      : scm.remoteError
        ? ({ tone: "error", message: scm.remoteError } as const)
        : scm.actionMessage
          ? ({ tone: "success", message: scm.actionMessage } as const)
          : null,
  };
}
