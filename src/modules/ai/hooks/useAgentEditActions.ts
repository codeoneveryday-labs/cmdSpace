import { useCallback } from "react";
import { native } from "@/modules/ai/lib/native";
import type { AgentEditFile } from "@/modules/ai/lib/agentChatEdits";

export function useAgentEditActions({
  editFiles,
  setEditFiles,
  onOpenFileDiff,
}: {
  editFiles: AgentEditFile[];
  setEditFiles: (files: AgentEditFile[]) => void;
  onOpenFileDiff?: (input: {
    path: string;
    repoRoot: string;
    mode: "-";
    originalPath: string | null;
  }) => void;
}) {
  const reviewEdits = useCallback(() => {
    for (const file of editFiles) {
      onOpenFileDiff?.({
        path: file.path,
        repoRoot: file.repoRoot,
        mode: "-",
        originalPath: file.originalPath,
      });
    }
  }, [editFiles, onOpenFileDiff]);

  const undoEdits = useCallback(async () => {
    if (editFiles.length === 0) return;
    const repoRoot = editFiles[0]?.repoRoot;
    if (!repoRoot || editFiles.some((file) => file.repoRoot !== repoRoot)) return;
    await native.gitDiscard(
      repoRoot,
      editFiles.map((file) => ({ path: file.path, untracked: file.untracked })),
    );
    setEditFiles([]);
  }, [editFiles, setEditFiles]);

  return { reviewEdits, undoEdits };
}
