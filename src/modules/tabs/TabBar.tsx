import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KEY_SEP } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  useAgentBlockedLeaves,
  useAgentCompletedLeaves,
  useAgentResponseLeaves,
  useAgentResponseRequestedLeaves,
} from "@/modules/terminal/lib/agentActivity";
import { leafIds } from "@/modules/terminal/lib/panes";
import type { AgentDisplayState } from "@/modules/terminal/AgentStateDot";
import {
  getBindingTokens,
  SHORTCUTS,
  type ShortcutId,
} from "@/modules/shortcuts/shortcuts";
import {
  Cancel01Icon,
  CanvasIcon,
  ComputerTerminal02Icon,
  GitBranchIcon,
  IncognitoIcon,
  MusicNote01Icon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef } from "react";
import type { EditorTab, Tab } from "./lib/useTabs";
import { useTabBarDrag, type TabPlacement } from "./useTabBarDrag";
import { useTabBarMusicState } from "./useTabBarMusicState";
import { TabBarTabContent } from "./TabBarTabContent";

type Props = {
  tabs: Tab[];
  activeId: number;
  onSelect: (id: number) => void;
  onReorder: (
    draggedId: number,
    targetId: number,
    placement?: TabPlacement,
  ) => void;
  onNew: () => void;
  onNewPrivate: () => void;
  onNewEditor: () => void;
  onNewGitGraph: () => void;
  canNewGitGraph: boolean;
  onNewArchitecture: () => void;
  onNewMusic: () => void;
  onClose: (id: number) => void;
  /** Pin (promote) a preview tab to persistent on double-click. */
  onPin: (id: number) => void;
  compact?: boolean;
};

export function TabBar({
  tabs,
  activeId,
  onSelect,
  onReorder,
  onNew,
  onNewPrivate,
  onNewEditor,
  onNewGitGraph,
  canNewGitGraph,
  onNewArchitecture,
  onNewMusic,
  onClose,
  onPin,
  compact,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const respondingLeaves = useAgentResponseLeaves();
  const requestedLeaves = useAgentResponseRequestedLeaves();
  const blockedLeaves = useAgentBlockedLeaves();
  const completedLeaves = useAgentCompletedLeaves();
  const userShortcuts = usePreferencesStore((s) => s.shortcuts);
  const isMusicPlaying = useTabBarMusicState(tabs);

  const shortcutFor = (id: ShortcutId): string => {
    const shortcut = SHORTCUTS.find((item) => item.id === id);
    if (!shortcut) return "";
    const bindings = userShortcuts[id] || shortcut.defaultBindings;
    return getBindingTokens(bindings[0]).join(KEY_SEP);
  };

  // Horizontal wheel scroll without holding shift.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Keep the active tab visible after selection / open.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`);
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, tabs.length]);

  const {
    dragVisual,
    draggedTab,
    renderedTabs,
    placeholderIndex,
    beginDrag,
  } = useTabBarDrag({ tabs, scrollRef, onSelect, onReorder });

  return (
    <div
      ref={scrollRef}
      className="min-w-0 shrink overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex w-max items-center gap-0.5">
        <Tabs
          value={String(activeId)}
          onValueChange={(v) => onSelect(Number(v))}
        >
          <TabsList className="h-7 w-max gap-0.5 bg-transparent p-0">
            {renderedTabs.flatMap((t, index) => {
              const placeholder =
                dragVisual !== null && index === placeholderIndex
                  ? [
                      <div
                        key="drag-placeholder"
                        aria-hidden="true"
                        className="h-7 shrink-0 rounded-md border border-primary/50 bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.18)] transition-[width,opacity] duration-150"
                        style={{ width: dragVisual.width }}
                      />,
                    ]
                  : [];
              const isPreview = t.kind === "editor" && (t as EditorTab).preview;
              const agentResponding =
                t.kind === "terminal" &&
                leafIds(t.paneTree).some((leafId) => respondingLeaves.has(leafId));
              const agentState: AgentDisplayState | undefined =
                t.id === activeId || t.kind !== "terminal"
                  ? undefined
                  : leafIds(t.paneTree).some((leafId) => blockedLeaves.has(leafId))
                    ? "blocked"
                      : leafIds(t.paneTree).some((leafId) => requestedLeaves.has(leafId)) || agentResponding
                      ? "working"
                      : leafIds(t.paneTree).some((leafId) => completedLeaves.has(leafId))
                        ? "done"
                        : undefined;
              return [
                ...placeholder,
                <TabsTrigger
                  key={t.id}
                  value={String(t.id)}
                  data-tab-id={t.id}
                  onClick={() => onSelect(t.id)}
                  onPointerDown={(e) => {
                    beginDrag(e, t.id);
                  }}
                  onDoubleClick={() => isPreview && onPin(t.id)}
                  className={cn(
                    "group h-7 min-w-0 max-w-28 shrink gap-1.5 rounded-md text-xs text-muted-foreground transition-colors data-[state=active]:bg-accent data-[state=active]:text-foreground hover:text-foreground/80 justify-between sm:max-w-36 md:max-w-40",
                    "cursor-default",
                    t.kind === "terminal" && t.title === "Music CLI" && isMusicPlaying &&
                      "cmdspace-music-playing-tab",
                    compact
                      ? "px-1.5!"
                      : tabs.length === 1
                        ? "px-2!"
                        : "ps-2! pe-1!",
                  )}
                >
                  <TabBarTabContent
                    tab={t}
                    compact={compact}
                    musicPlaying={isMusicPlaying}
                    agentState={agentState}
                  />
                  {tabs.length > 1 && (
                    <span
                      role="button"
                      aria-label="Close tab"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose(t.id);
                      }}
                      className="rounded p-0.5 opacity-0 transition-opacity hover:bg-accent hover:opacity-100 group-hover:opacity-60"
                    >
                      <HugeiconsIcon
                        icon={Cancel01Icon}
                        size={11}
                        strokeWidth={2}
                      />
                    </span>
                  )}
                </TabsTrigger>
              ];
            })}
            {dragVisual !== null && placeholderIndex === renderedTabs.length ? (
              <div
                key="drag-placeholder-end"
                aria-hidden="true"
                className="h-7 shrink-0 rounded-md border border-primary/50 bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.18)] transition-[width,opacity] duration-150"
                style={{ width: dragVisual.width }}
              />
            ) : null}
          </TabsList>
        </Tabs>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              title="New tab"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={2} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <NewTabMenuItem
              icon={ComputerTerminal02Icon}
              label="Terminal"
              shortcut={shortcutFor("tab.new")}
              onSelect={onNew}
            />
            <NewTabMenuItem
              icon={IncognitoIcon}
              label="Privacy"
              shortcut={shortcutFor("tab.newPrivate")}
              onSelect={onNewPrivate}
            />
            <NewTabMenuItem
              icon={PencilEdit02Icon}
              label="Editor"
              shortcut={shortcutFor("tab.newEditor")}
              onSelect={onNewEditor}
            />
            <NewTabMenuItem
              icon={GitBranchIcon}
              label="Git Graph"
              shortcut={shortcutFor("tab.newGitGraph")}
              disabled={!canNewGitGraph}
              title={canNewGitGraph ? undefined : "No Git repository"}
              onSelect={onNewGitGraph}
            />
            <NewTabMenuItem
              icon={MusicNote01Icon}
              label="Music CLI"
              shortcut={shortcutFor("music.open")}
              onSelect={onNewMusic}
            />
            <NewTabMenuItem
              icon={CanvasIcon}
              label="Architecture"
              shortcut={shortcutFor("tab.newArchitecture")}
              onSelect={onNewArchitecture}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {dragVisual !== null && draggedTab !== null ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 flex items-center justify-between gap-1.5 rounded-md bg-accent px-2 text-xs text-foreground shadow-lg ring-1 ring-primary/50"
          style={{
            height: dragVisual.height,
            left: dragVisual.x,
            top: dragVisual.y,
            width: dragVisual.width,
          }}
        >
          <TabBarTabContent tab={draggedTab} compact={compact} musicPlaying={isMusicPlaying} />
        </div>
      ) : null}
    </div>
  );
}

function NewTabMenuItem({
  icon,
  label,
  onSelect,
  shortcut,
  disabled = false,
  title,
}: {
  icon: typeof ComputerTerminal02Icon;
  label: string;
  onSelect: () => void;
  shortcut: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      disabled={disabled}
      title={title}
      className="grid grid-cols-[22px_1fr_48px] gap-3 disabled:opacity-40"
    >
      <HugeiconsIcon icon={icon} size={14} strokeWidth={1.75} />
      <span className="min-w-0 truncate">{label}</span>
      <span className="text-right text-[11px] font-medium tabular-nums leading-none text-muted-foreground">
        {shortcut}
      </span>
    </DropdownMenuItem>
  );
}
