import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fileIconUrl } from "@/modules/explorer/lib/iconResolver";
import { RemoveSquareIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { memo, type ReactNode } from "react";
import type { CheckState, SourceControlFileEntry } from "./useSourceControlPanel";

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return "";
  return normalized.slice(0, index);
}

function entryPathLabel(entry: SourceControlFileEntry): string {
  if (entry.originalPath) return `${entry.originalPath} → ${entry.path}`;
  return dirname(entry.path);
}

function statusAccent(code: string): string {
  switch (code) {
    case "A": return "bg-emerald-500/85";
    case "U": return "bg-teal-500/85";
    case "M": return "bg-amber-500/85";
    case "D": return "bg-rose-500/85";
    case "R": return "bg-sky-500/85";
    default: return "bg-muted-foreground/40";
  }
}

function checkboxValue(state: CheckState): boolean | "indeterminate" {
  if (state === "checked") return true;
  if (state === "indeterminate") return "indeterminate";
  return false;
}

export function IconActionButton({ label, disabled, side = "left", onClick, children }: { label: string; disabled?: boolean; side?: "left" | "top" | "right" | "bottom"; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon-sm" variant="ghost" className="size-6 cursor-pointer rounded-md p-3 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed" aria-label={label} disabled={disabled} onClick={onClick}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent side={side} className="border border-border/70 bg-zinc-950 text-[10.5px] text-zinc-100 shadow-lg shadow-black/30">{label}</TooltipContent>
    </Tooltip>
  );
}

export const SourceControlEntryRow = memo(function SourceControlEntryRow({
  rowKey,
  entry,
  focused,
  selectedPath,
  actionBusy,
  onFocusRow,
  onSelectFile,
  onToggleStageFile,
  onDiscardFile,
}: {
  rowKey: string;
  entry: SourceControlFileEntry;
  focused: boolean;
  selectedPath: string | null;
  actionBusy: string | null;
  onFocusRow: (key: string | null) => void;
  onSelectFile: (entry: SourceControlFileEntry) => Promise<void>;
  onToggleStageFile: (entry: SourceControlFileEntry) => Promise<void>;
  onDiscardFile: (entry: SourceControlFileEntry) => void;
}) {
  const isSelected = selectedPath === entry.path;
  const fileName = basename(entry.path);
  const iconUrl = fileIconUrl(fileName);
  const pathLabel = entryPathLabel(entry);
  const showDiscard = entry.unstaged;
  const isStageBusy = actionBusy === `stage:${entry.path}` || actionBusy === `unstage:${entry.path}`;
  const isDiscardBusy = actionBusy === `discard:${entry.path}`;
  const disabled = actionBusy !== null;
  return (
    <div id={`scm-row-${rowKey}`} data-focused={focused || undefined} data-selected={isSelected || undefined} role="option" aria-selected={isSelected} onMouseDown={() => onFocusRow(rowKey)} className={cn("group relative flex h-[30px] items-center gap-2 rounded-md pl-2 pr-2 transition-all duration-100", focused ? "bg-accent/60" : isSelected ? "bg-accent/55 text-foreground" : "hover:bg-accent/30")}>
      <span className={cn("pointer-events-none absolute inset-y-1 left-0 w-[2px] rounded-full transition-opacity", statusAccent(entry.statusCode), isSelected || focused ? "opacity-100" : "opacity-55 group-hover:opacity-95")} aria-hidden />
      <button type="button" onClick={() => { onFocusRow(rowKey); void onSelectFile(entry); }} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left">
        {iconUrl ? <img src={iconUrl} alt="" className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5 leading-none"><span className={cn("truncate text-[12px] leading-tight", isSelected || focused ? "font-semibold text-foreground" : "font-medium text-foreground/95", pathLabel ? "max-w-[58%] shrink-0" : "min-w-0 flex-1")}>{fileName}</span>{pathLabel ? <span className="min-w-0 flex-1 truncate text-[10.5px] leading-tight text-muted-foreground/75">{pathLabel}</span> : null}</div>
      </button>
      {showDiscard ? <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 data-[focused=true]:opacity-100 data-[selected=true]:opacity-100"><IconActionButton label={`Discard ${entry.path}`} disabled={disabled} onClick={() => onDiscardFile(entry)}>{isDiscardBusy ? <Spinner className="size-3" /> : <HugeiconsIcon icon={RemoveSquareIcon} size={11} strokeWidth={1.9} />}</IconActionButton></div> : null}
      <span className="flex size-5 shrink-0 items-center justify-center">{isStageBusy ? <Spinner className="size-3" /> : <Checkbox aria-label={`Stage ${entry.path}`} checked={checkboxValue(entry.checkState)} disabled={disabled} onCheckedChange={() => void onToggleStageFile(entry)} className="size-3.5" />}</span>
    </div>
  );
});
