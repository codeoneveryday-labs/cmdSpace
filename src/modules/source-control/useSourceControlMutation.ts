import type { GitRepoInfo, GitStatusSnapshot } from "@/modules/ai/lib/native";
import {
  invalidateDiff,
  workingDiffKey,
} from "@/modules/editor/lib/diffCache";
import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { SourceControlSummary } from "./useSourceControl";

export function normalizeSourceControlError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown source control error";
}

export function useSourceControlMutation({
  repo,
  summary,
  setBusy,
  setActionError,
  setActionMessage,
  cancelReconcile,
  scheduleReconcile,
}: {
  repo: GitRepoInfo | null;
  summary: SourceControlSummary;
  setBusy: Dispatch<SetStateAction<string | null>>;
  setActionError: Dispatch<SetStateAction<string | null>>;
  setActionMessage: Dispatch<SetStateAction<string | null>>;
  cancelReconcile: () => void;
  scheduleReconcile: () => void;
}) {
  return useCallback(
    async (
      busyKey: string,
      optimistic: ((status: GitStatusSnapshot) => GitStatusSnapshot) | null,
      ipc: () => Promise<void>,
      affected: string[],
    ) => {
      if (!repo || summary.busyAction) return;
      setBusy(busyKey);
      setActionMessage(null);
      setActionError(null);
      if (optimistic) summary.applyStatus(optimistic);
      for (const path of affected) {
        invalidateDiff(workingDiffKey(repo.repoRoot, path, "+"));
        invalidateDiff(workingDiffKey(repo.repoRoot, path, "-"));
      }
      try {
        await ipc();
        scheduleReconcile();
      } catch (error) {
        setActionError(normalizeSourceControlError(error));
        cancelReconcile();
        await summary.refresh({ remote: "never" }).catch(() => {});
      } finally {
        setBusy(null);
      }
    },
    [
      cancelReconcile,
      repo,
      scheduleReconcile,
      setActionError,
      setActionMessage,
      setBusy,
      summary,
    ],
  );
}
