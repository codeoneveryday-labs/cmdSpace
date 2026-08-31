import { Checkbox } from "@/components/ui/checkbox";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SourceControlEntryRow } from "./SourceControlEntryRow";
import type { CheckState, SourceControlFileEntry } from "./useSourceControlPanel";

const ROW_HEIGHTS = { banner: 32, header: 30, entry: 30 } as const;
type Row = { kind: "banner"; key: string } | { kind: "header"; key: string; count: number } | { kind: "entry"; key: string; entry: SourceControlFileEntry };

function checkboxValue(state: CheckState): boolean | "indeterminate" {
  if (state === "checked") return true;
  if (state === "indeterminate") return "indeterminate";
  return false;
}

function DivergedBanner() {
  return <div className="mx-2 mt-1 flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-foreground/[0.04] px-2 text-[10.5px] leading-none text-muted-foreground"><HugeiconsIcon icon={Alert02Icon} size={11} strokeWidth={1.9} className="shrink-0" /><span className="min-w-0 flex-1 truncate"><span className="font-medium text-foreground/85">Diverged from upstream</span><span className="ml-1 opacity-75">— resolve in terminal</span></span></div>;
}

function ChangeHeader({ count, actionBusy, headerCheckState, onToggleAll }: { count: number; actionBusy: string | null; headerCheckState: CheckState; onToggleAll: () => Promise<void> | void }) {
  return <div className="flex h-7 items-center gap-2 px-3"><span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/85">Changes</span><span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-border/60 px-1 text-[9.5px] font-semibold tabular-nums text-muted-foreground">{count}</span><label className="ml-auto flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground hover:text-foreground"><span>All</span><Checkbox aria-label="Stage all changes" checked={checkboxValue(headerCheckState)} disabled={actionBusy !== null} onCheckedChange={() => void onToggleAll()} className="size-3.5" /></label></div>;
}

export function SourceControlChangeList({
  fileEntries,
  isDiverged,
  selectedPath,
  actionBusy,
  headerCheckState,
  onToggleAll,
  onSelectFile,
  onToggleStageFile,
  onDiscardFile,
  onRefresh,
}: {
  fileEntries: SourceControlFileEntry[];
  isDiverged: boolean;
  selectedPath: string | null;
  actionBusy: string | null;
  headerCheckState: CheckState;
  onToggleAll: () => Promise<void> | void;
  onSelectFile: (entry: SourceControlFileEntry) => Promise<void>;
  onToggleStageFile: (entry: SourceControlFileEntry) => Promise<void>;
  onDiscardFile: (entry: SourceControlFileEntry) => void;
  onRefresh: () => void;
}) {
  const rows = useMemo<Row[]>(() => {
    const next: Row[] = [];
    if (isDiverged) next.push({ kind: "banner", key: "banner-diverged" });
    if (fileEntries.length > 0) {
      next.push({ kind: "header", key: "list-header", count: fileEntries.length });
      for (const entry of fileEntries) next.push({ kind: "entry", key: entry.key, entry });
    }
    return next;
  }, [fileEntries, isDiverged]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedRowKey, setFocusedRowKey] = useState<string | null>(null);
  const rowKeyToIndex = useMemo(() => new Map(rows.map((row, index) => [row.key, index])), [rows]);
  const focusableIndices = useMemo(() => rows.flatMap((row, index) => row.kind === "entry" ? [index] : []), [rows]);
  useEffect(() => { if (focusedRowKey && !rowKeyToIndex.has(focusedRowKey)) setFocusedRowKey(null); }, [focusedRowKey, rowKeyToIndex]);
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: (index) => rows[index]?.kind === "banner" ? ROW_HEIGHTS.banner : rows[index]?.kind === "header" ? ROW_HEIGHTS.header : ROW_HEIGHTS.entry, overscan: 12, getItemKey: (index) => rows[index]?.key ?? index });
  const moveFocus = useCallback((direction: 1 | -1) => {
    if (focusableIndices.length === 0) return;
    const current = focusedRowKey === null ? -1 : (rowKeyToIndex.get(focusedRowKey) ?? -1);
    let position = focusableIndices.findIndex((index) => index === current);
    if (position === -1) position = direction > 0 ? -1 : focusableIndices.length;
    const next = Math.max(0, Math.min(focusableIndices.length - 1, position + direction));
    const rowIndex = focusableIndices[next];
    const row = rows[rowIndex];
    if (!row) return;
    setFocusedRowKey(row.key);
    virtualizer.scrollToIndex(rowIndex, { align: "auto" });
  }, [focusableIndices, focusedRowKey, rowKeyToIndex, rows, virtualizer]);
  const focusedEntry = () => {
    if (!focusedRowKey) return null;
    const row = rows[rowKeyToIndex.get(focusedRowKey) ?? -1];
    return row?.kind === "entry" ? row.entry : null;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.closest("button"))) return;
    const meta = event.metaKey || event.ctrlKey;
    if (meta && (event.key === "r" || event.key === "R")) { event.preventDefault(); onRefresh(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); moveFocus(event.key === "ArrowDown" ? 1 : -1); return; }
    const entry = focusedEntry();
    if (!entry) return;
    if (event.key === "Enter") { event.preventDefault(); void onSelectFile(entry); }
    if (!meta && (event.key === " " || event.key === "s" || event.key === "S")) { event.preventDefault(); void onToggleStageFile(entry); }
    if (!meta && (event.key === "d" || event.key === "D") && entry.unstaged) { event.preventDefault(); onDiscardFile(entry); }
  };
  return <div ref={containerRef} tabIndex={0} role="listbox" aria-label="Changed files" aria-activedescendant={focusedRowKey ? `scm-row-${focusedRowKey}` : undefined} onKeyDown={onKeyDown} className="relative min-h-0 flex-1 outline-none focus-visible:ring-1 focus-visible:ring-primary/30"><div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"><div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>{virtualizer.getVirtualItems().map((virtualRow) => { const row = rows[virtualRow.index]; if (!row) return null; return <div key={virtualRow.key} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}>{row.kind === "banner" ? <DivergedBanner /> : row.kind === "header" ? <ChangeHeader count={row.count} actionBusy={actionBusy} headerCheckState={headerCheckState} onToggleAll={onToggleAll} /> : <SourceControlEntryRow rowKey={row.key} entry={row.entry} focused={focusedRowKey === row.key} selectedPath={selectedPath} actionBusy={actionBusy} onFocusRow={setFocusedRowKey} onSelectFile={onSelectFile} onToggleStageFile={onToggleStageFile} onDiscardFile={onDiscardFile} />}</div>; })}</div></div></div>;
}
