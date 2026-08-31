import { useEffect, useRef, useState } from "react";
import { native, type GitChangedFile } from "@/modules/ai/lib/native";
import {
  countDiffLines,
  countTextLines,
  createAgentEditBaseline,
  filesChangedByAgent,
  type AgentEditFile,
} from "@/modules/ai/lib/agentChatEdits";
import type { AgentChatTimelineState } from "@/modules/ai/lib/agentChatTimeline";

export function useAgentEditSummary({
  cwd,
  timelineStatus,
}: {
  cwd: string;
  timelineStatus: AgentChatTimelineState["status"];
}) {
  const [editFiles, setEditFiles] = useState<AgentEditFile[]>([]);
  const editBaselineRef = useRef<ReturnType<typeof createAgentEditBaseline>>(null);
  const previousTimelineStatusRef = useRef(timelineStatus);

  useEffect(() => {
    const wasRunning = previousTimelineStatusRef.current === "running";
    previousTimelineStatusRef.current = timelineStatus;
    if (!wasRunning || timelineStatus !== "idle") return;
    const baseline = editBaselineRef.current;
    if (!baseline) return;
    editBaselineRef.current = null;
    let cancelled = false;
    void native.gitPanelSnapshot(cwd)
      .then(async (snapshot) => {
        const changed = filesChangedByAgent(baseline, snapshot);
        const files = await Promise.all(changed.map(async (file: GitChangedFile) => {
          let counts = { added: 0, removed: 0 };
          try {
            const diff = await native.gitDiff(snapshot.repo?.repoRoot ?? baseline.repoRoot, file.path, false);
            counts = countDiffLines(diff.diffText);
          } catch {
            // A file can disappear before the post-turn status refresh.
          }
          if (file.untracked && counts.added === 0 && counts.removed === 0) {
            try {
              const absolutePath = `${snapshot.repo?.repoRoot ?? baseline.repoRoot}/${file.path}`;
              const content = await native.readFile(absolutePath);
              if (content.kind === "text") counts = { added: countTextLines(content.content), removed: 0 };
            } catch {
              // Keep the file visible even if its contents are unavailable.
            }
          }
          return {
            path: file.path,
            originalPath: file.originalPath,
            repoRoot: snapshot.repo?.repoRoot ?? baseline.repoRoot,
            added: counts.added,
            removed: counts.removed,
            untracked: file.untracked,
          } satisfies AgentEditFile;
        }));
        if (!cancelled) setEditFiles(files);
      })
      .catch(() => {
        if (!cancelled) setEditFiles([]);
      });
    return () => { cancelled = true; };
  }, [cwd, timelineStatus]);

  const beginEditTracking = (snapshot: Parameters<typeof createAgentEditBaseline>[0] | null) => {
    editBaselineRef.current = snapshot
      ? createAgentEditBaseline(snapshot)
      : null;
    setEditFiles([]);
  };

  return { editFiles, setEditFiles, beginEditTracking };
}
