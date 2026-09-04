import { cn } from "@/lib/utils";
import { truncateMiddle } from "@/lib/truncateMiddle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Cancel01Icon,
  ComputerTerminal02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { TerminalNavigationControls } from "./TerminalNavigationControls";
import { TerminalPane, type TerminalPaneHandle } from "./TerminalPane";
import { disposeSession } from "./lib/useTerminalSession";
import {
  MAX_BOTTOM_TERMINAL_HEIGHT,
  MIN_BOTTOM_TERMINAL_HEIGHT,
  useBottomTerminalResize,
} from "./useBottomTerminalResize";
import { useBottomTerminalTabDrag } from "./useBottomTerminalTabDrag";

const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = MIN_BOTTOM_TERMINAL_HEIGHT;
const MAX_HEIGHT = MAX_BOTTOM_TERMINAL_HEIGHT;

type BottomTerminalTab = {
  id: number;
  cwd?: string;
};

type TabPlacement = "before" | "after";

let nextBottomTerminalTabId = 1_000_000;

const createTerminalTab = (cwd?: string): BottomTerminalTab => ({
  id: nextBottomTerminalTabId++,
  cwd,
});

export type BottomTerminalDrawerHandle = {
  focus: () => void;
};

type Props = {
  cwd?: string | null;
  codingAgentCount: number;
  onClose: () => void;
};

function tabLabel(tab: BottomTerminalTab): string {
  return tab.cwd?.replace(/\/$/, "").split("/").pop() || "Terminal";
}

export const BottomTerminalDrawer = forwardRef<BottomTerminalDrawerHandle, Props>(
  function BottomTerminalDrawer({ cwd: initialCwd, codingAgentCount, onClose }, ref) {
    const firstTabRef = useRef<BottomTerminalTab | null>(null);
    if (!firstTabRef.current) {
      firstTabRef.current = createTerminalTab(initialCwd ?? undefined);
    }

    const terminalRefs = useRef(new Map<number, TerminalPaneHandle>());
    const tabIdsRef = useRef<number[]>([]);
    const tabDragRef = useRef<{
      id: number;
      pointerId: number;
      startX: number;
      dragging: boolean;
    } | null>(null);
    const [tabs, setTabs] = useState<BottomTerminalTab[]>(() => [firstTabRef.current!]);
    const [activeTabId, setActiveTabId] = useState(firstTabRef.current.id);
    const [height, setHeight] = useState(DEFAULT_HEIGHT);
    tabIdsRef.current = tabs.map((tab) => tab.id);

    const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

    useEffect(() => {
      return () => {
        tabIdsRef.current.forEach(disposeSession);
      };
    }, []);

    const { resizing, handleResizeStart, handleResizeMove, handleResizeEnd } =
      useBottomTerminalResize({ height, onHeightChange: setHeight });

    const addTerminalTab = () => {
      const tab = createTerminalTab(activeTab?.cwd ?? initialCwd ?? undefined);
      setTabs((current) => [...current, tab]);
      setActiveTabId(tab.id);
    };

    useImperativeHandle(
      ref,
      () => ({
        focus: () => terminalRefs.current.get(activeTabId)?.focus(),
      }),
      [activeTabId, addTerminalTab],
    );

    const closeTerminalTab = (tabId: number) => {
      if (tabs.length === 1) return;
      disposeSession(tabId);
      setTabs((current) => {
        const index = current.findIndex((tab) => tab.id === tabId);
        const nextTabs = current.filter((tab) => tab.id !== tabId);
        if (tabId === activeTabId) {
          setActiveTabId(nextTabs[Math.max(0, index - 1)]?.id ?? nextTabs[0].id);
        }
        return nextTabs;
      });
    };

    const reorderTabs = useCallback(
      (draggedId: number, targetId: number, placement: TabPlacement) => {
        setTabs((current) => {
          const dragged = current.find((tab) => tab.id === draggedId);
          const targetIndex = current.findIndex((tab) => tab.id === targetId);
          if (!dragged || targetIndex === -1 || draggedId === targetId) return current;
          const withoutDragged = current.filter((tab) => tab.id !== draggedId);
          const targetIndexWithoutDragged = withoutDragged.findIndex((tab) => tab.id === targetId);
          const insertAt = targetIndexWithoutDragged + (placement === "after" ? 1 : 0);
          return [
            ...withoutDragged.slice(0, insertAt),
            dragged,
            ...withoutDragged.slice(insertAt),
          ];
        });
      },
      [],
    );

    const { draggingTabId, beginDrag } = useBottomTerminalTabDrag({
      tabRef: tabDragRef,
      focusTab: (id) => {
        setActiveTabId(id);
        requestAnimationFrame(() => terminalRefs.current.get(id)?.focus());
      },
      reorderTabs,
    });

    const updateTabCwd = (tabId: number, cwd: string) => {
      setTabs((current) => current.map((tab) => (tab.id === tabId ? { ...tab, cwd } : tab)));
    };

    const changeDirectory = (path: string) => {
      if (!activeTab) return;
      terminalRefs.current.get(activeTab.id)?.write(`cd '${path.replace(/'/g, "'\\''")}'\r`);
      terminalRefs.current.get(activeTab.id)?.focus();
    };

    const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLElement>, tabId: number) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setActiveTabId(tabId);
      requestAnimationFrame(() => terminalRefs.current.get(tabId)?.focus());
    };

    return (
      <section
        data-bottom-terminal-drawer
        className={cn(
          "relative flex flex-col overflow-hidden border border-border/70 bg-[var(--terminal-background)] dark:border-zinc-800/80",
          resizing && "select-none",
        )}
        style={{ height }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div
          role="separator"
          aria-label="Resize bottom terminal"
          aria-orientation="horizontal"
          aria-valuemin={MIN_HEIGHT}
          aria-valuemax={MAX_HEIGHT}
          aria-valuenow={height}
          tabIndex={0}
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          className="absolute inset-x-0 -top-1 z-20 h-2 cursor-row-resize touch-none before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-border/70 hover:before:bg-primary"
        />
        <div className="relative flex h-10 shrink-0 items-center gap-1 overflow-hidden border-b border-border/60 bg-card/95 px-3 text-sm shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/95">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={0}
                  data-bottom-terminal-tab={tab.id}
                  onPointerDown={(event) => beginDrag(event, tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                  className={cn(
                    "flex h-8 max-w-72 shrink-0 cursor-grab items-center gap-2 rounded-xl px-3 text-sm transition-colors active:cursor-grabbing",
                    draggingTabId === tab.id && "cursor-grabbing opacity-60 ring-1 ring-primary/50",
                    isActive
                      ? "bg-muted text-foreground dark:bg-zinc-900"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-900/70 dark:hover:text-zinc-100",
                  )}
                >
                  <HugeiconsIcon
                    icon={ComputerTerminal02Icon}
                    size={18}
                    strokeWidth={1.9}
                    className="shrink-0"
                  />
                  {isActive ? (
                    <TerminalNavigationControls
                      cwd={tab.cwd}
                      onChangeDirectory={changeDirectory}
                      className="gap-2"
                    />
                  ) : (
                    <span className="max-w-44 truncate font-semibold" title={tabLabel(tab)}>
                      {truncateMiddle(tabLabel(tab), 24)}
                    </span>
                  )}
                  {tabs.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Close ${tabLabel(tab)}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeTerminalTab(tab.id);
                      }}
                      className="-mr-1 rounded p-0.5 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={1.8} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <span
            className="ml-2 shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground dark:bg-zinc-900 dark:text-zinc-300"
            title="Coding agents configured in this workspace"
          >
            Coding agents {codingAgentCount}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open terminal menu"
                title="Open terminal menu"
                onPointerDown={(event) => event.stopPropagation()}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <HugeiconsIcon icon={PlusSignIcon} size={22} strokeWidth={1.8} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40">
              <DropdownMenuItem aria-label="Open terminal" onSelect={() => addTerminalTab()}>
                <HugeiconsIcon icon={ComputerTerminal02Icon} size={14} strokeWidth={1.8} />
                <span>Terminal</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
            className="ml-auto shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Close bottom terminal"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} />
          </button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {tabs.map((tab) => (
            <div key={tab.id} className="absolute inset-0">
              <TerminalPane
                ref={(handle) => {
                  if (handle) terminalRefs.current.set(tab.id, handle);
                  else terminalRefs.current.delete(tab.id);
                }}
                leafId={tab.id}
                visible={tab.id === activeTabId}
                focused={tab.id === activeTabId}
                initialCwd={tab.cwd}
                onCwd={(_leafId, cwd) => updateTabCwd(tab.id, cwd)}
              />
            </div>
          ))}
        </div>
      </section>
    );
  },
);
