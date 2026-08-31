import {
  ArrowDown01Icon,
  FileAddIcon,
  UndoIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import type { AgentEditFile } from "@/modules/ai/lib/agentChatEdits";

const PREVIEW_FILE_COUNT = 3;

export function AgentEditCard({
  files,
  onReview,
  onUndo,
}: {
  files: AgentEditFile[];
  onReview: () => void;
  onUndo: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const added = files.reduce((total, file) => total + file.added, 0);
  const removed = files.reduce((total, file) => total + file.removed, 0);
  const remainingCount = Math.max(0, files.length - PREVIEW_FILE_COUNT);
  const visibleFiles = expanded ? files : files.slice(0, PREVIEW_FILE_COUNT);

  return (
    <section
      className="overflow-hidden rounded-[22px] border border-foreground/[0.14] bg-foreground/[0.035]"
      aria-label={`Edited ${files.length} ${files.length === 1 ? "file" : "files"}`}
    >
      <div className="flex min-h-32 items-center gap-5 border-b border-foreground/[0.12] px-6 py-5 sm:px-7">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-[18px] bg-background/75 text-foreground">
          <HugeiconsIcon icon={FileAddIcon} size={34} strokeWidth={1.65} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-medium tracking-[-0.015em] text-foreground sm:text-2xl">
            Edited {files.length} {files.length === 1 ? "file" : "files"}
          </p>
          <p className="mt-1 text-lg tabular-nums sm:text-xl">
            <span className="text-emerald-400">+{added}</span>
            <span className="ml-2 text-red-400">-{removed}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex h-11 items-center gap-2 rounded-xl px-2 text-lg text-foreground/90 transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Undo
            <HugeiconsIcon icon={UndoIcon} size={22} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={onReview}
            className="inline-flex h-14 items-center rounded-2xl border border-foreground/[0.16] bg-background/25 px-5 text-lg font-medium text-foreground transition-colors hover:bg-foreground/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Review
          </button>
        </div>
      </div>
      <div className="py-1.5">
        {visibleFiles.map((file) => (
          <button
            key={`${file.repoRoot}:${file.path}`}
            type="button"
            onClick={onReview}
            className="flex min-h-[4.45rem] w-full items-center gap-5 px-6 text-left text-base transition-colors hover:bg-foreground/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-7 sm:text-lg"
          >
            <span
              className="min-w-0 flex-1 truncate text-foreground/70"
              title={file.path}
            >
              {file.path}
            </span>
            <span className="shrink-0 text-lg tabular-nums sm:text-xl">
              <span className="text-emerald-400">+{file.added}</span>
              <span className="ml-2 text-red-400">-{file.removed}</span>
            </span>
          </button>
        ))}
      </div>
      {remainingCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex min-h-[4.5rem] w-full items-center gap-3 border-t border-foreground/[0.035] bg-foreground/[0.04] px-6 text-left text-lg text-foreground transition-colors hover:bg-foreground/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-7 sm:text-xl"
          aria-expanded={expanded}
        >
          <span>{expanded ? "Show fewer files" : `Show ${remainingCount} more files`}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={20}
            strokeWidth={1.9}
            className={expanded ? "rotate-180 transition-transform" : "transition-transform"}
          />
        </button>
      ) : null}
    </section>
  );
}
