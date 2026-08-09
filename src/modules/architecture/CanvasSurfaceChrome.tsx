import { cn } from "@/lib/utils";
import {
  Add01Icon,
  Cancel01Icon,
  Globe02Icon,
  LockIcon,
  SquareUnlock01Icon,
  TerminalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

export type CanvasSurfaceTab = {
  id: string;
  label: string;
  kind?: "terminal" | "browser";
};

type Props = {
  kind: "browser";
  tabs: CanvasSurfaceTab[];
  activeTabId: string;
  singleSurfaceGroup: boolean;
  surfaceGroupLocked: boolean;
  maximized: boolean;
  children: ReactNode;
  onActivate: () => void;
  onActivateTab: (id: string) => void;
  onTabPointerDown: (
    id: string,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onRequestCloseTab: (id: string) => void;
  onAddTab: () => void;
  onSplitRight: () => void;
  onHeaderPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleSurfaceGroupLock: () => void;
  onToggleSurfaceGroupMaximize: () => void;
  onRequestCloseSurfaceGroup: () => void;
};

export function CanvasSurfaceChrome({
  kind,
  tabs,
  activeTabId,
  singleSurfaceGroup,
  surfaceGroupLocked,
  maximized,
  children,
  onActivate,
  onActivateTab,
  onTabPointerDown,
  onRequestCloseTab,
  onAddTab,
  onSplitRight,
  onHeaderPointerDown,
  onToggleSurfaceGroupLock,
  onToggleSurfaceGroupMaximize,
  onRequestCloseSurfaceGroup,
}: Props) {
  const label = "browser";
  const controls = (
    <>
      <ChromeButton label={`Add ${label} tab`} onClick={onAddTab}>
        <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.8} />
      </ChromeButton>
      <ChromeButton label={`Split ${label} right`} onClick={onSplitRight}>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M12 4v16" />
        </svg>
      </ChromeButton>
      {singleSurfaceGroup ? (
        <>
          <ChromeButton
            label={`${surfaceGroupLocked ? "Unlock" : "Lock"} ${label} group`}
            onClick={onToggleSurfaceGroupLock}
            active={surfaceGroupLocked}
          >
            <HugeiconsIcon icon={surfaceGroupLocked ? LockIcon : SquareUnlock01Icon} size={13} strokeWidth={1.8} />
          </ChromeButton>
          <ChromeButton
            label={`${maximized ? "Restore" : "Maximize"} ${label} group`}
            onClick={onToggleSurfaceGroupMaximize}
          >
            <MaximizeIcon maximized={maximized} />
          </ChromeButton>
          <ChromeButton label={`Close ${label} group`} onClick={onRequestCloseSurfaceGroup} destructive>
            <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.8} />
          </ChromeButton>
        </>
      ) : null}
    </>
  );
  return (
    <div
      data-canvas-surface-chrome={kind}
      className="group relative isolate flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[12px] border border-border/70 bg-background shadow-[0_12px_32px_rgba(15,23,42,0.18)] [clip-path:inset(0_round_12px)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.42)]"
      onPointerDown={(event) => {
        onActivate();
        const target = event.target as HTMLElement;
        const topBar =
          event.clientY - event.currentTarget.getBoundingClientRect().top < 28;
        if (topBar && !target.closest("button")) {
          onHeaderPointerDown(event);
          return;
        }
        event.stopPropagation();
      }}
    >
      <div className="relative z-20 flex h-7 shrink-0 items-center gap-0.5 border-b border-border/60 bg-white/95 px-1 text-muted-foreground shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-300">
          <div
            role="tablist"
            aria-label={`Canvas ${label} tabs`}
            className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
          >
            {tabs.map((tab) => {
              const tabKind = tab.kind ?? kind;
              const tabIcon =
                tabKind === "terminal" ? TerminalIcon : Globe02Icon;
              return (
                <div
                  key={tab.id}
                  data-canvas-surface-tab-kind={tabKind}
                  className={cn(
                    "flex max-w-52 shrink-0 items-center rounded-full py-0.5 pr-1 text-[11px] font-normal transition-colors",
                    tab.id === activeTabId
                      ? "bg-muted text-foreground shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:hover:bg-zinc-800/70",
                  )}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab.id === activeTabId}
                    className="flex min-w-0 items-center gap-1 px-2"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onActivateTab(tab.id);
                      onTabPointerDown(tab.id, event);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onActivateTab(tab.id);
                    }}
                  >
                    <HugeiconsIcon icon={tabIcon} size={12} strokeWidth={1.8} />
                    <span className="truncate">{tab.label}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Close ${tab.label}`}
                    title={`Close ${tab.label}`}
                    className="grid size-4 shrink-0 place-items-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestCloseTab(tab.id);
                    }}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={1.8} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {controls}
          </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function ChromeButton({
  label,
  active = false,
  destructive = false,
  children,
  onClick,
}: {
  label: string;
  active?: boolean;
  destructive?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
        active && "text-primary hover:text-primary",
        destructive && "hover:bg-red-500/[0.08] hover:text-red-500 dark:hover:bg-red-500/15 dark:hover:text-red-400",
      )}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MaximizeIcon({ maximized }: { maximized: boolean }) {
  return maximized ? (
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
  );
}
