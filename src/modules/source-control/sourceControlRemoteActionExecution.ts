import type { GitRepoInfo, GitStatusSnapshot } from "@/modules/ai/lib/native";

export type SourceControlRemoteAction = "fetch" | "pull" | "push";
export type SourceControlRemoteActionMode =
  | "contextual"
  | SourceControlRemoteAction;

export type SourceControlRemoteActionResult = {
  ok: boolean;
  action: SourceControlRemoteAction | null;
  error?: string;
  blocked?: "diverged" | "missing-upstream" | "no-repo";
};

export function getContextualRemoteAction(
  status: GitStatusSnapshot | null,
): SourceControlRemoteAction | null {
  if (!status?.upstream) return null;
  if (status.ahead > 0 && status.behind > 0) return null;
  if (status.behind > 0) return "pull";
  if (status.ahead > 0) return "push";
  return "fetch";
}

export async function performSourceControlRemoteAction({
  repo,
  status,
  mode,
  fetch,
  pull,
  push,
  refresh,
}: {
  repo: GitRepoInfo | null;
  status: GitStatusSnapshot | null;
  mode: SourceControlRemoteActionMode;
  fetch: () => Promise<void>;
  pull: () => Promise<void>;
  push: () => Promise<void>;
  refresh: () => Promise<void>;
}): Promise<SourceControlRemoteActionResult> {
  if (!repo || !status) return { ok: false, action: null, blocked: "no-repo" };
  if (!status.upstream) {
    return { ok: false, action: null, blocked: "missing-upstream" };
  }

  const action = mode === "contextual" ? getContextualRemoteAction(status) : mode;
  if (!action) return { ok: false, action: null, blocked: "diverged" };

  try {
    if (action === "fetch") await fetch();
    else if (action === "pull") await pull();
    else await push();
    await refresh();
    return { ok: true, action };
  } catch (error) {
    const message = normalizeError(error);
    await refresh().catch(() => {});
    return { ok: false, action, error: message };
  }
}

function normalizeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown source control error";
}
