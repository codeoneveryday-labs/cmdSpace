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
import { fileIconUrl } from "@/modules/explorer/lib/iconResolver";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { useAgentResponseLeaves } from "@/modules/terminal/lib/agentActivity";
import { leafIds } from "@/modules/terminal/lib/panes";
import { invoke } from "@tauri-apps/api/core";
import {
  getBindingTokens,
  SHORTCUTS,
  type ShortcutId,
} from "@/modules/shortcuts/shortcuts";
import {
  Cancel01Icon,
  Clock01Icon,
  ComputerTerminal02Icon,
  GitBranchIcon,
  GitCompareIcon,
  Globe02Icon,
  AiNetworkIcon,
  IncognitoIcon,
  MusicNote01Icon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import type { EditorTab, Tab } from "./lib/useTabs";

type TabPlacement = "before" | "after";
type PointerDragState = {
  dragging: boolean;
  id: number;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  x: number;
  y: number;
  previewIndex: number;
};

type DragVisualState = Pick<
  PointerDragState,
  "id" | "width" | "height" | "x" | "y" | "previewIndex"
>;

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
  onNewPreview: () => void;
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
  onNewPreview,
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
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const [dragVisual, setDragVisual] = useState<DragVisualState | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const respondingLeaves = useAgentResponseLeaves();
  const userShortcuts = usePreferencesStore((s) => s.shortcuts);
  const hasMusicTab = tabs.some((tab) => tab.kind === "terminal" && tab.title === "Music CLI");

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

  useEffect(() => {
    if (!hasMusicTab) {
      setIsMusicPlaying(false);
      return;
    }

    let disposed = false;
    const refresh = () => {
      void invoke<boolean>("music_is_playing")
        .then((playing) => {
          if (!disposed) setIsMusicPlaying(playing);
        })
        .catch(() => {
          if (!disposed) setIsMusicPlaying(false);
        });
    };
    refresh();
    const intervalId = window.setInterval(refresh, 2_000);
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [hasMusicTab]);

  useEffect(() => {
    const previewIndexForPointer = (drag: PointerDragState, clientX: number) => {
      const tabCenterX = clientX - drag.offsetX + drag.width / 2;
      const siblings = tabs.filter((tab) => tab.id !== drag.id);
      for (let index = 0; index < siblings.length; index += 1) {
        const sibling = scrollRef.current?.querySelector<HTMLElement>(
          `[data-tab-id="${siblings[index].id}"]`,
        );
        if (!sibling) continue;
        const bounds = sibling.getBoundingClientRect();
        if (tabCenterX < bounds.left + bounds.width / 2) return index;
      }
      return siblings.length;
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const moved =
        Math.abs(e.clientX - drag.startX) > 4 ||
        Math.abs(e.clientY - drag.startY) > 4;
      if (!drag.dragging && !moved) return;
      const dragging = drag.dragging || moved;
      const nextDrag: PointerDragState = {
        ...drag,
        dragging,
        x: e.clientX - drag.offsetX,
        y: e.clientY - drag.offsetY,
        previewIndex: previewIndexForPointer(drag, e.clientX),
      };
      pointerDragRef.current = nextDrag;
      setDragVisual({
        id: nextDrag.id,
        width: nextDrag.width,
        height: nextDrag.height,
        x: nextDrag.x,
        y: nextDrag.y,
        previewIndex: nextDrag.previewIndex,
      });
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      if (drag.dragging) {
        const siblings = tabs.filter((tab) => tab.id !== drag.id);
        const target =
          drag.previewIndex >= siblings.length
            ? siblings[siblings.length - 1]
            : siblings[drag.previewIndex];
        if (target) {
          onReorder(
            drag.id,
            target.id,
            drag.previewIndex >= siblings.length ? "after" : "before",
          );
        }
      }
      pointerDragRef.current = null;
      setDragVisual(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onReorder, tabs]);

  const draggedTab =
    dragVisual === null
      ? null
      : (tabs.find((tab) => tab.id === dragVisual.id) ?? null);
  const renderedTabs =
    dragVisual === null
      ? tabs
      : tabs.filter((tab) => tab.id !== dragVisual.id);
  const placeholderIndex =
    dragVisual === null
      ? -1
      : Math.min(Math.max(dragVisual.previewIndex, 0), renderedTabs.length);

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
              return [
                ...placeholder,
                <TabsTrigger
                  key={t.id}
                  value={String(t.id)}
                  data-tab-id={t.id}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    const target = e.target as HTMLElement | null;
                    if (target?.closest('[aria-label="Close tab"]')) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    pointerDragRef.current = {
                      dragging: false,
                      id: t.id,
                      pointerId: e.pointerId,
                      startX: e.clientX,
                      startY: e.clientY,
                      offsetX: e.clientX - rect.left,
                      offsetY: e.clientY - rect.top,
                      width: rect.width,
                      height: rect.height,
                      x: rect.left,
                      y: rect.top,
                      previewIndex: tabs.findIndex((tab) => tab.id === t.id),
                    };
                  }}
                  onDoubleClick={() => isPreview && onPin(t.id)}
                  className={cn(
                    "group h-7 shrink-0 gap-1.5 rounded-md text-xs text-muted-foreground transition-colors data-[state=active]:bg-accent data-[state=active]:text-foreground hover:text-foreground/80 justify-between",
                    "cursor-default",
                    t.kind === "terminal" && t.title === "Music CLI" && isMusicPlaying &&
                      "cmdspace-music-playing-tab",
                    agentResponding && "cmdspace-agent-response-tab",
                    compact
                      ? "px-1.5!"
                      : tabs.length === 1
                        ? "px-2!"
                        : "ps-2! pe-1!",
                  )}
                >
                  <TabTriggerContent tab={t} compact={compact} musicPlaying={isMusicPlaying} />
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
              icon={Globe02Icon}
              label="Preview"
              shortcut={shortcutFor("tab.newPreview")}
              onSelect={onNewPreview}
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
              icon={AiNetworkIcon}
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
          <TabTriggerContent tab={draggedTab} compact={compact} musicPlaying={isMusicPlaying} />
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

function TabTriggerContent({
  tab,
  compact,
  musicPlaying,
}: {
  tab: Tab;
  compact?: boolean;
  musicPlaying: boolean;
}) {
  const isPreview = tab.kind === "editor" && (tab as EditorTab).preview;
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 truncate",
        compact ? "max-w-48" : "max-w-80",
      )}
    >
      <TabIcon tab={tab} musicPlaying={musicPlaying} />
      {/* Preview tabs use italic to signal the transient state,
          matching the visual convention from VSCode. */}
      <span className={cn("truncate", isPreview && "italic")}>
        {labelFor(tab)}
      </span>
      {tab.kind === "editor" && tab.dirty ? (
        <span
          aria-label="Unsaved changes"
          className="size-1.5 shrink-0 rounded-full bg-foreground/70"
        />
      ) : null}
    </span>
  );
}

function TabIcon({ tab, musicPlaying }: { tab: Tab; musicPlaying: boolean }) {
  if (tab.kind === "terminal" && tab.title === "Music CLI") {
    return (
      <HugeiconsIcon
        icon={MusicNote01Icon}
        size={14}
        strokeWidth={2}
        className={cn("shrink-0", musicPlaying && "cmdspace-music-tab-icon")}
      />
    );
  }
  if (tab.kind === "editor" || tab.kind === "markdown") {
    const url = fileIconUrl(tab.title);
    return url ? <img src={url} alt="" className="size-3.5 shrink-0" /> : null;
  }
  if (tab.kind === "preview") {
    return (
      <HugeiconsIcon
        icon={Globe02Icon}
        size={14}
        strokeWidth={2}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "ai-diff") {
    return (
      <HugeiconsIcon
        icon={GitCompareIcon}
        size={14}
        strokeWidth={2}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "terminal" && tab.private) {
    return (
      <HugeiconsIcon
        icon={IncognitoIcon}
        size={14}
        strokeWidth={2}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "git-diff" || tab.kind === "git-commit-file") {
    return (
      <HugeiconsIcon
        icon={GitCompareIcon}
        size={14}
        strokeWidth={2}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "git-history") {
    return (
      <HugeiconsIcon
        icon={Clock01Icon}
        size={14}
        strokeWidth={2}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "architecture") {
    return (
      <HugeiconsIcon
        icon={AiNetworkIcon}
        size={14}
        strokeWidth={2}
        className="shrink-0"
      />
    );
  }
  return (
    <HugeiconsIcon
      icon={ComputerTerminal02Icon}
      size={14}
      strokeWidth={2}
      className="shrink-0"
    />
  );
}

function labelFor(t: Tab): string {
  if (t.kind === "editor") return t.title;
  if (t.kind === "preview") return t.title;
  if (t.kind === "markdown") return t.title;
  if (t.kind === "ai-diff") return t.title;
  if (t.kind === "git-diff") return t.title;
  if (t.kind === "git-history") return t.title;
  if (t.kind === "architecture") return t.title;
  if (t.kind === "git-commit-file") return t.title;
  if (t.kind === "terminal" && t.title !== "shell" && t.title !== "workspace") {
    return t.title;
  }
  if (!t.cwd) return t.title;
  const parts = t.cwd.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "/";
}
