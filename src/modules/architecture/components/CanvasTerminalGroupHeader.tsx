import { Cancel01Icon, LockIcon, SquareUnlock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
} from "../lib/architectureCanvasTypes";

export function CanvasTerminalGroupHeader({
  group,
  activeTerminalNode,
  locked,
  maximizedTerminal,
  onPointerDown,
  onToggleLock,
  onToggleMaximize,
  onClose,
}: {
  group: ArchitectureTerminalDockGroup;
  activeTerminalNode: ArchitectureNode;
  locked: boolean;
  maximizedTerminal?: string;
  onPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    group: ArchitectureTerminalDockGroup,
    activeTerminalNode: ArchitectureNode,
    locked: boolean,
  ) => void;
  onToggleLock: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}) {
  return (
    <div
      data-canvas-terminal-group-header="true"
      className="pointer-events-auto absolute z-30 flex h-7 items-center rounded-t-[12px] border-b border-border/60 bg-white/95 text-muted-foreground shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-300"
      style={{
        left: `${group.x}px`,
        top: `${group.y}px`,
        width: `${group.width}px`,
      }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        if (maximizedTerminal) {
          event.preventDefault();
          event.stopPropagation();
          onToggleMaximize();
          return;
        }
        onPointerDown(event, group, activeTerminalNode, locked);
      }}
    >
      <span className="min-w-0 flex-1" />
      <div className="flex shrink-0 items-center gap-0.5 px-1">
        <button
          type="button"
          aria-label={locked ? "Unlock terminal group" : "Lock terminal group"}
          title={locked ? "Unlock terminal group" : "Lock terminal group"}
          className={cn(
            "grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
            locked && "text-primary hover:text-primary",
          )}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggleLock}
        >
          <HugeiconsIcon
            icon={locked ? LockIcon : SquareUnlock01Icon}
            size={13}
            strokeWidth={1.8}
          />
        </button>
        <button
          type="button"
          aria-label={maximizedTerminal ? "Restore terminal group" : "Maximize terminal group"}
          title={maximizedTerminal ? "Restore terminal group" : "Maximize terminal group"}
          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggleMaximize}
        >
          {maximizedTerminal ? (
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14h6v6" />
              <path d="M10 14l-6 6" />
              <path d="M20 10h-6V4" />
              <path d="M14 10l6-6" />
            </svg>
          ) : (
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </svg>
          )}
        </button>
        <button
          type="button"
          aria-label="Close terminal group"
          title="Close terminal group"
          className="grid size-5 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/[0.08] hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-zinc-400 dark:hover:bg-red-500/15 dark:hover:text-red-400"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
