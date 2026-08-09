import { cn } from "@/lib/utils";
import { SidebarBrowserPane } from "@/modules/preview";
import {
  Cancel01Icon,
  Globe02Icon,
  LockIcon,
  SquareUnlock01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PointerEvent as ReactPointerEvent } from "react";

type Props = {
  url: string;
  active: boolean;
  locked: boolean;
  interactionBlocked: boolean;
  boundsRevision: string | number;
  onUrlChange: (url: string) => void;
  onActivate: () => void;
  onHeaderPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleLock: () => void;
  onRequestClose: () => void;
};

export function CanvasBrowserNode({
  url,
  active,
  locked,
  interactionBlocked,
  boundsRevision,
  onUrlChange,
  onActivate,
  onHeaderPointerDown,
  onToggleLock,
  onRequestClose,
}: Props) {
  return (
    <div
      data-canvas-browser-node="true"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[12px] border border-border/70 bg-background shadow-[0_12px_32px_rgba(15,23,42,0.18)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.42)]"
      onPointerDown={onActivate}
    >
      <div
        className={cn(
          "flex h-8 shrink-0 cursor-grab items-center gap-2 border-b border-border/60 bg-card/95 px-2 active:cursor-grabbing",
          locked && "cursor-not-allowed active:cursor-not-allowed",
        )}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          onHeaderPointerDown(event);
        }}
      >
        <HugeiconsIcon icon={Globe02Icon} size={14} strokeWidth={1.8} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
          {browserTitle(url)}
        </span>
        <button
          type="button"
          aria-label={locked ? "Unlock browser node" : "Lock browser node"}
          title={locked ? "Unlock browser node" : "Lock browser node"}
          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          aria-label="Close browser node"
          title="Close browser node"
          disabled={locked}
          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onRequestClose}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.8} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <SidebarBrowserPane
          url={url}
          visible={active}
          resizing={interactionBlocked}
          boundsRevision={boundsRevision}
          onUrlChange={onUrlChange}
        />
      </div>
    </div>
  );
}

function browserTitle(url: string): string {
  if (!url) return "Browser";
  try {
    return new URL(url).host || "Browser";
  } catch {
    return url;
  }
}
