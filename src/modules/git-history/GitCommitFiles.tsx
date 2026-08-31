import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { fileIconUrl } from "@/modules/explorer/lib/iconResolver";
import type { GitCommitFileChange, GitLogEntry } from "@/modules/ai/lib/native";
import { memo } from "react";
import { basename, dirname, statusTone } from "./gitHistoryPresentation";

type FilesEntry =
  | { state: "loading" }
  | { state: "loaded"; files: GitCommitFileChange[] }
  | { state: "error"; error: string };

export function GitCommitFiles({
  commit,
  filesEntry,
  onOpenFile,
  onRetry,
}: {
  commit: GitLogEntry;
  filesEntry: FilesEntry | null;
  onOpenFile: (commit: GitLogEntry, file: GitCommitFileChange) => Promise<void> | void;
  onRetry: () => void;
}) {
  if (!filesEntry || filesEntry.state === "loading") {
    return <div className="flex items-center gap-2 px-3 py-3 text-[11px] text-muted-foreground"><Spinner className="size-3" />Loading files…</div>;
  }
  if (filesEntry.state === "error") {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-3 text-[11px] text-destructive">
        <span className="truncate">{filesEntry.error}</span>
        <Button size="xs" variant="ghost" className="h-6 cursor-pointer text-[11px]" onClick={onRetry}>Retry</Button>
      </div>
    );
  }
  if (filesEntry.files.length === 0) {
    return <div className="px-3 py-3 text-[11px] text-muted-foreground">No file changes.</div>;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/85">
        <span>Files</span>
        <span className="rounded-sm bg-muted/55 px-1 py-px text-[9.5px] tabular-nums text-muted-foreground/85 normal-case tracking-normal">{filesEntry.files.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
        <ul className="space-y-px px-1.5 pb-2">
          {filesEntry.files.map((file) => <li key={file.path}><FileRow file={file} onOpen={() => void onOpenFile(commit, file)} /></li>)}
        </ul>
      </div>
    </div>
  );
}

const FileRow = memo(function FileRow({ file, onOpen }: { file: GitCommitFileChange; onOpen: () => void }) {
  const fileName = basename(file.path);
  const directory = dirname(file.path);
  const iconUrl = fileIconUrl(fileName);
  return (
    <button type="button" onClick={onOpen} className="group flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-1.5 text-left transition-colors hover:bg-accent/40">
      {iconUrl ? <img src={iconUrl} alt="" className="size-3.5 shrink-0" /> : <span className="size-3.5 shrink-0" />}
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5 leading-none">
        <span className="truncate text-[11.5px] font-medium leading-tight">{fileName}</span>
        {directory ? <span className="min-w-0 flex-1 truncate text-[10px] leading-tight text-muted-foreground/80">{directory}</span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1 text-[10px] tabular-nums">
        {file.isBinary ? <span className="text-muted-foreground/70">binary</span> : <><>{file.added > 0 ? <span className="text-emerald-600 dark:text-emerald-400">+{file.added}</span> : null}</>{file.removed > 0 ? <span className="text-rose-600 dark:text-rose-400">−{file.removed}</span> : null}</>}
      </div>
      <span className={cn("inline-flex w-4 shrink-0 justify-center text-[9.5px] font-bold leading-none tabular-nums", statusTone(file.status))} title={file.statusLabel}>{file.status.toUpperCase()}</span>
    </button>
  );
});
