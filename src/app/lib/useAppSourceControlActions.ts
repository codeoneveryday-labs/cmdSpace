import { useCallback } from "react";
import { native } from "@/modules/ai/lib/native";

type SourceControlState = {
  hasRepo: boolean;
  repo: { repoRoot: string } | null;
  status: { branch: string | null } | null;
};

export function useAppSourceControlActions({
  sourceControl,
  sourceControlContextPath,
  setEditorSidebarView,
  cycleSidebarView,
  openCommitHistoryTab,
}: {
  sourceControl: SourceControlState;
  sourceControlContextPath: string | null;
  setEditorSidebarView: (view: "files" | "source-control") => void;
  cycleSidebarView: (view: "editor") => void;
  openCommitHistoryTab: (input: { repoRoot: string; branch: string | null }) => void;
}) {
  const toggleSourceControl = useCallback(() => {
    setEditorSidebarView("source-control");
    cycleSidebarView("editor");
  }, [cycleSidebarView, setEditorSidebarView]);

  const openGitGraphFromContext = useCallback(async () => {
    const known = sourceControl.hasRepo ? sourceControl.repo : null;
    if (known) {
      openCommitHistoryTab({
        repoRoot: known.repoRoot,
        branch: sourceControl.status?.branch ?? null,
      });
      return;
    }
    if (!sourceControlContextPath) return;
    try {
      const repo = await native.gitResolveRepo(sourceControlContextPath);
      if (!repo) return;
      openCommitHistoryTab({ repoRoot: repo.repoRoot, branch: repo.branch });
    } catch {
      // A missing or unauthorized repository has no graph to open.
    }
  }, [openCommitHistoryTab, sourceControl, sourceControlContextPath]);

  return { toggleSourceControl, openGitGraphFromContext };
}
