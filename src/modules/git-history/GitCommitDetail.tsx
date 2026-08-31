import { Button } from "@/components/ui/button";
import {
  Copy01Icon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import type { GitCommitFileChange, GitLogEntry } from "@/modules/ai/lib/native";
import { absoluteTime } from "./gitHistoryPresentation";
import { GitCommitFiles } from "./GitCommitFiles";
import { commitWebUrl, hostLabel, type RemoteWebInfo } from "./lib/remoteWebUrl";

type FilesEntry =
  | { state: "loading" }
  | { state: "loaded"; files: GitCommitFileChange[] }
  | { state: "error"; error: string };

export function GitCommitDetail({
  commit,
  filesEntry,
  remoteWeb,
  onCopySha,
  onOpenFile,
  onRetryFiles,
}: {
  commit: GitLogEntry;
  filesEntry: FilesEntry | null;
  remoteWeb: RemoteWebInfo | null;
  onCopySha: (value: string) => Promise<void> | void;
  onOpenFile: (commit: GitLogEntry, file: GitCommitFileChange) => Promise<void> | void;
  onRetryFiles: () => void;
}) {
  const absolute = absoluteTime(commit.timestampSecs);
  const webUrl = remoteWeb ? commitWebUrl(remoteWeb, commit.sha) : null;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1100);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <div className="flex max-h-[60vh] min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/45 p-3">
        <div className="flex items-start gap-2">
          <span className="mt-px shrink-0 rounded bg-muted/65 px-1.5 py-0.5 font-mono text-[10.5px] leading-none tabular-nums text-muted-foreground">{commit.shortSha}</span>
          <div className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-foreground">
            {commit.subject || <span className="text-muted-foreground">(no subject)</span>}
          </div>
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="truncate">{commit.author || "Unknown"}</span>
          {commit.authorEmail ? <><span className="text-muted-foreground/45">·</span><span className="truncate text-muted-foreground/85">{commit.authorEmail}</span></> : null}
          <span className="text-muted-foreground/45">·</span>
          <span className="shrink-0 tabular-nums">{absolute}</span>
        </div>
        <div className="mt-2.5 flex items-center gap-1">
          <Button size="xs" variant="ghost" className="h-6 cursor-pointer gap-1.5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => { void onCopySha(commit.sha); setCopied(true); }}>
            <HugeiconsIcon icon={Copy01Icon} size={11} strokeWidth={1.9} />
            {copied ? "Copied" : "Copy SHA"}
          </Button>
          {webUrl ? <Button size="xs" variant="ghost" className="h-6 cursor-pointer gap-1.5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => void openUrl(webUrl).catch(console.error)}>
            <HugeiconsIcon icon={LinkSquare02Icon} size={11} strokeWidth={1.9} />
            {hostLabel(remoteWeb!)}
          </Button> : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <GitCommitFiles commit={commit} filesEntry={filesEntry} onOpenFile={onOpenFile} onRetry={onRetryFiles} />
      </div>
    </div>
  );
}
