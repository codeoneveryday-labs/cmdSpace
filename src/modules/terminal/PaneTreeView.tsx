import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { GroupImperativeHandle } from "react-resizable-panels";
import type { SearchAddon } from "@xterm/addon-search";
import { TerminalPane, type TerminalPaneHandle } from "./TerminalPane";
import { TerminalNavigationControls } from "./TerminalNavigationControls";
import { type PaneNode, type SplitDir } from "./lib/panes";
import { native } from "@/modules/ai/lib/native";
import {
  getAgentUsageStatuses,
  type AgentUsageStatus,
} from "./lib/terminal-native";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { setTerminalResizePaused } from "./lib/rendererPool";
import { useAgentCliCommand } from "./lib/agentActivity";
import {
  GIT_REPO_CHANGED_EVENT,
  gitRepoRootFromChangedEvent,
  pathBelongsToRepo,
} from "@/modules/git/events";
import {
  detectCliAgent,
} from "./lib/cliAgents";
import { AgentCliIcon } from "./AgentCliIcon";
import { cn } from "@/lib/utils";

const PANE_RESIZE_RESUME_DELAY_MS = 48;
const PANE_SPLIT_MIN_SIZE = 10;
const DEFAULT_FOCUS_ACCENT_COLOR = "#0088ff";

type LeafBundle = {
  setRef: (h: TerminalPaneHandle | null) => void;
  getRef: () => TerminalPaneHandle | null;
  onSearch: (addon: SearchAddon) => void;
  onCwd: (cwd: string) => void;
  onExit: (code: number) => void;
  onCommand?: (cmd: string) => void;
};

type Props = {
  node: PaneNode;
  tabVisible: boolean;
  activeLeafId: number;
  onFocusLeaf: (leafId: number) => void;
  getBundle: (leafId: number) => LeafBundle;
  onCloseLeaf: (leafId: number) => void;
  onChangeDirectory: (path: string) => void;
  onToggleMaximize: (leafId: number) => void;
  isMaximized: boolean;
  canMaximize: boolean;
  onSplitPane: (dir: SplitDir) => void;
  focusAccentColor: string;
  isLeafHydrated: (leafId: number) => boolean;
  onHydrateLeaf: (leafId: number) => void;
  onPaneTreeChange: (node: PaneNode) => void;
  dragContext?: PaneDragContext;
  broadcastEnabled: boolean;
  broadcastTargetLeafIds: readonly number[];
  canBroadcast: boolean;
  onToggleBroadcast: () => void;
  onToggleBroadcastTarget: (leafId: number) => void;
};

export type PaneDragContext = {
  draggingId: number | null;
  targetId: number | null;
  targetOffset: { x: number; y: number } | null;
  onDragStart: (
    leafId: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
};

export function PaneTreeView({
  node,
  tabVisible,
  activeLeafId,
  onFocusLeaf,
  getBundle,
  onCloseLeaf,
  onChangeDirectory,
  onToggleMaximize,
  isMaximized,
  canMaximize,
  onSplitPane,
  focusAccentColor,
  isLeafHydrated,
  onHydrateLeaf,
  onPaneTreeChange,
  dragContext,
  broadcastEnabled,
  broadcastTargetLeafIds,
  canBroadcast,
  onToggleBroadcast,
  onToggleBroadcastTarget,
}: Props) {
  const groupRef = useRef<GroupImperativeHandle | null>(null);
  const paneResizeResumeTimerRef = useRef<number | null>(null);
  const paneResizeDragCleanupRef = useRef<(() => void) | null>(null);
  const [agentResponding, setAgentResponding] = useState(false);
  const [outputActive, setOutputActive] = useState(false);
  const storedAgentCommand = useAgentCliCommand(
    node.kind === "leaf" ? node.id : undefined,
  );
  const [detectedAgentCommand, setDetectedAgentCommand] = useState<string | undefined>(
    () => (node.kind === "leaf" && detectCliAgent(node.lastCommand) ? node.lastCommand : undefined),
  );
  const clearPaneResizeResumeTimer = useCallback(() => {
    if (paneResizeResumeTimerRef.current === null) return;
    window.clearTimeout(paneResizeResumeTimerRef.current);
    paneResizeResumeTimerRef.current = null;
  }, []);
  const resumeTerminalResizeAfterPaneDrag = useCallback(() => {
    clearPaneResizeResumeTimer();
    paneResizeResumeTimerRef.current = window.setTimeout(() => {
      paneResizeResumeTimerRef.current = null;
      requestAnimationFrame(() => {
        setTerminalResizePaused(false);
      });
    }, PANE_RESIZE_RESUME_DELAY_MS);
  }, [clearPaneResizeResumeTimer]);

  useEffect(() => {
    return () => {
      paneResizeDragCleanupRef.current?.();
      clearPaneResizeResumeTimer();
      setTerminalResizePaused(false);
    };
  }, [clearPaneResizeResumeTimer]);

  if (node.kind === "leaf") {
    const focused = node.id === activeLeafId;
    const hydrated = isLeafHydrated(node.id);
    const b = getBundle(node.id);
    const isDragging = dragContext?.draggingId === node.id;
    const isDropTarget = dragContext?.targetId === node.id;
    const targetStyle =
      isDropTarget && dragContext?.targetOffset
        ? {
            transform: `translate(${dragContext.targetOffset.x}px, ${dragContext.targetOffset.y}px) scale(0.985)`,
          }
        : undefined;
    const focusAndHydrate = () => {
      onHydrateLeaf(node.id);
      if (!focused) onFocusLeaf(node.id);
    };
    return (
      <div
        onMouseDownCapture={() => {
          focusAndHydrate();
        }}
        // Catches focus from Tab, programmatic focus, or any path that
        // skips mousedown — keeps activeLeafId in sync with DOM focus.
        onFocus={() => {
          focusAndHydrate();
        }}
        data-pane-leaf={node.id}
        style={targetStyle}
        className={`relative h-full w-full group overflow-hidden @container transition-[transform,opacity,box-shadow] duration-150 ease-out motion-reduce:transition-none ${
          isDropTarget
            ? "z-10 opacity-90 shadow-xl shadow-primary/20"
            : ""
        } ${
          isDropTarget
            ? "bg-primary/[0.04] ring-2 ring-inset ring-primary/80"
            : ""
        }`}
      >
        {isDragging ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-40 border-2 border-dashed border-primary/80"
          />
        ) : null}
        {hydrated ? (
          <TerminalPane
            leafId={node.id}
            visible={tabVisible}
            focused={focused}
            initialCwd={node.cwd}
            initialCommand={node.autoLaunch ? node.lastCommand : undefined}
            ref={b.setRef}
            onSearchReady={(_id, addon) => b.onSearch(addon)}
            onCwd={(_id, cwd) => b.onCwd(cwd)}
            onExit={(_id, code) => b.onExit(code)}
            onCommand={(_id, cmd) => {
              if (detectCliAgent(cmd)) setDetectedAgentCommand(cmd);
              b.onCommand?.(cmd);
            }}
            onAgentActivity={(_id, responding) => setAgentResponding(responding)}
            onOutputActivity={(_id, active) => setOutputActive(active)}
          />
        ) : null}

        {/* Focus outline around the active terminal pane. */}
        {focused && (
          <div
    className="absolute inset-0 pointer-events-none border-2 z-30"
            style={paneFocusStyle(focusAccentColor)}
          />
        )}

        {/* Centered premium capsule floating control overlay with git status & active model */}
        <FloatingTerminalOverlay
          cwd={node.cwd}
          nodeId={node.id}
          focused={focused}
          canMaximize={canMaximize}
          isMaximized={isMaximized}
          onSplitPane={onSplitPane}
          onToggleMaximize={onToggleMaximize}
          onCloseLeaf={onCloseLeaf}
          onCd={(path) => {
            focusAndHydrate();
            onChangeDirectory(path);
          }}
          agentCommand={detectedAgentCommand ?? storedAgentCommand ?? node.lastCommand}
          agentResponding={agentResponding}
          hydrated={hydrated}
          onDragStart={(event) => dragContext?.onDragStart(node.id, event)}
          isDragging={isDragging}
          broadcastEnabled={broadcastEnabled}
          broadcastTargeted={broadcastTargetLeafIds.includes(node.id)}
          canBroadcast={canBroadcast}
          onToggleBroadcast={onToggleBroadcast}
          onToggleBroadcastTarget={() => onToggleBroadcastTarget(node.id)}
          outputActive={outputActive}
        />
      </div>
    );
  }

  const splitNode = node;
  const isHorizontalGroup = splitNode.dir === "row";

  function getGroupSize(groupElement: HTMLElement): number {
    return Array.from(groupElement.children).reduce((size, child) => {
      if (!(child instanceof HTMLElement)) return size;
      if (!child.hasAttribute("data-panel")) return size;
      return size + (isHorizontalGroup ? child.offsetWidth : child.offsetHeight);
    }, 0);
  }

  function applyAdjacentPaneDelta(
    nextIndex: number,
    deltaPercent: number,
    baseLayout = groupRef.current?.getLayout(),
  ): Record<string, number> | undefined {
    const group = groupRef.current;
    if (!group || !baseLayout) return undefined;

    const prevChild = splitNode.children[nextIndex - 1];
    const nextChild = splitNode.children[nextIndex];
    if (!prevChild || !nextChild) return undefined;

    const prevPanelId = `pane-${prevChild.id}`;
    const nextPanelId = `pane-${nextChild.id}`;
    const prevStart = baseLayout[prevPanelId];
    const nextStart = baseLayout[nextPanelId];
    if (prevStart === undefined || nextStart === undefined) return undefined;

    const adjacentTotal = prevStart + nextStart;
    const minSize = Math.min(PANE_SPLIT_MIN_SIZE, adjacentTotal / 2);
    const nextPrevSize = Math.min(
      Math.max(prevStart + deltaPercent, minSize),
      adjacentTotal - minSize,
    );

    return group.setLayout({
      ...baseLayout,
      [prevPanelId]: nextPrevSize,
      [nextPanelId]: adjacentTotal - nextPrevSize,
    });
  }

  function commitSplitLayout(layout: Record<string, number> | undefined): void {
    if (!layout) return;

    let changed = false;
    const nextChildren = splitNode.children.map((child) => {
      const size = layout[`pane-${child.id}`];
      if (size === undefined) return child;
      const normalizedSize = Number(size.toFixed(3));
      if (child.size === normalizedSize) return child;
      changed = true;
      return { ...child, size: normalizedSize };
    });
    if (changed) {
      onPaneTreeChange({ ...splitNode, children: nextChildren });
    }
  }

  function getDefaultLayout(): Record<string, number> | undefined {
    if (!splitNode.children.some((child) => child.size !== undefined)) {
      return undefined;
    }
    const fallbackSize = 100 / splitNode.children.length;
    return Object.fromEntries(
      splitNode.children.map((child) => [
        `pane-${child.id}`,
        child.size ?? fallbackSize,
      ]),
    );
  }

  function startZoomAwarePaneResize(
    event: ReactPointerEvent<HTMLDivElement>,
    nextIndex: number,
  ): void {
    if (event.button !== 0) return;

    const group = groupRef.current;
    const groupElement = event.currentTarget.parentElement;
    if (!group || !(groupElement instanceof HTMLElement)) return;

    const groupSize = getGroupSize(groupElement);
    if (groupSize <= 0) return;

    const startPoint = isHorizontalGroup ? event.clientX : event.clientY;
    const initialLayout = group.getLayout();
    const ownerDocument = event.currentTarget.ownerDocument;
    const ownerWindow = ownerDocument.defaultView ?? window;
    const target = event.currentTarget;
    const dragCursor = isHorizontalGroup ? "col-resize" : "row-resize";
    const previousBodyCursor = ownerDocument.body.style.cursor;
    const previousRootCursor = ownerDocument.documentElement.style.cursor;
    const previousUserSelect = ownerDocument.body.style.userSelect;
    let latestLayout = initialLayout;
    let latestPoint = startPoint;
    let frameId: number | null = null;

    event.preventDefault();
    event.stopPropagation();
    target.setPointerCapture?.(event.pointerId);

    paneResizeDragCleanupRef.current?.();
    clearPaneResizeResumeTimer();
    setTerminalResizePaused(true);
    ownerDocument.body.style.cursor = dragCursor;
    ownerDocument.documentElement.style.cursor = dragCursor;
    ownerDocument.body.style.userSelect = "none";

    const applyLatestPoint = () => {
      frameId = null;
      const zoomLevel = usePreferencesStore.getState().zoomLevel || 1;
      const deltaPercent =
        ((latestPoint - startPoint) / zoomLevel / groupSize) * 100;
      latestLayout =
        applyAdjacentPaneDelta(nextIndex, deltaPercent, initialLayout) ??
        latestLayout;
    };

    const scheduleApply = () => {
      if (frameId !== null) return;
      frameId = ownerWindow.requestAnimationFrame(applyLatestPoint);
    };

    const finish = () => {
      ownerDocument.removeEventListener("pointermove", handlePointerMove);
      ownerDocument.removeEventListener("pointerup", finish);
      ownerDocument.removeEventListener("pointercancel", finish);
      ownerWindow.removeEventListener("blur", finish);
      if (frameId !== null) {
        ownerWindow.cancelAnimationFrame(frameId);
        frameId = null;
        applyLatestPoint();
      }
      target.releasePointerCapture?.(event.pointerId);
      ownerDocument.body.style.cursor = previousBodyCursor;
      ownerDocument.documentElement.style.cursor = previousRootCursor;
      ownerDocument.body.style.userSelect = previousUserSelect;
      if (paneResizeDragCleanupRef.current === finish) {
        paneResizeDragCleanupRef.current = null;
      }
      commitSplitLayout(latestLayout);
      resumeTerminalResizeAfterPaneDrag();
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      latestPoint = isHorizontalGroup ? moveEvent.clientX : moveEvent.clientY;
      scheduleApply();
    };

    ownerDocument.addEventListener("pointermove", handlePointerMove);
    ownerDocument.addEventListener("pointerup", finish);
    ownerDocument.addEventListener("pointercancel", finish);
    ownerWindow.addEventListener("blur", finish);
    paneResizeDragCleanupRef.current = finish;
  }

  function handlePaneResizeKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
    nextIndex: number,
  ): void {
    const increment = event.shiftKey ? 10 : 5;
    const keyToDelta: Record<string, number | undefined> = isHorizontalGroup
      ? { ArrowLeft: -increment, ArrowRight: increment }
      : { ArrowUp: -increment, ArrowDown: increment };
    const delta = keyToDelta[event.key];
    if (delta === undefined) return;

    event.preventDefault();
    clearPaneResizeResumeTimer();
    setTerminalResizePaused(true);
    commitSplitLayout(applyAdjacentPaneDelta(nextIndex, delta));
    resumeTerminalResizeAfterPaneDrag();
  }

  return (
    <ResizablePanelGroup
      orientation={splitNode.dir === "row" ? "horizontal" : "vertical"}
      disabled
      groupRef={groupRef}
      defaultLayout={getDefaultLayout()}
    >
      {splitNode.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 && (
            <div
              role="separator"
              aria-orientation={isHorizontalGroup ? "vertical" : "horizontal"}
              tabIndex={0}
              onPointerDown={(event) => startZoomAwarePaneResize(event, i)}
              onKeyDown={(event) => handlePaneResizeKeyDown(event, i)}
              className={
                isHorizontalGroup
                  ? "relative z-20 flex w-px shrink-0 cursor-col-resize items-center justify-center bg-border outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2 after:content-[''] focus-visible:ring-1 focus-visible:ring-ring"
                  : "relative z-20 flex h-px w-full shrink-0 cursor-row-resize items-center justify-center bg-border outline-none after:absolute after:left-0 after:top-1/2 after:h-2 after:w-full after:-translate-y-1/2 after:content-[''] focus-visible:ring-1 focus-visible:ring-ring"
              }
            />
          )}
          <ResizablePanel id={`pane-${child.id}`} minSize="10%">
            <PaneTreeView
              node={child}
              tabVisible={tabVisible}
              activeLeafId={activeLeafId}
              onFocusLeaf={onFocusLeaf}
              getBundle={getBundle}
              onCloseLeaf={onCloseLeaf}
              onChangeDirectory={onChangeDirectory}
              onToggleMaximize={onToggleMaximize}
              isMaximized={isMaximized}
              canMaximize={canMaximize}
              onSplitPane={onSplitPane}
              focusAccentColor={focusAccentColor}
              isLeafHydrated={isLeafHydrated}
              onHydrateLeaf={onHydrateLeaf}
              onPaneTreeChange={(nextChild) =>
                onPaneTreeChange({
                  ...splitNode,
                  children: splitNode.children.map((current) =>
                    current.id === child.id ? nextChild : current,
                  ),
                })
              }
               dragContext={dragContext}
               broadcastEnabled={broadcastEnabled}
               broadcastTargetLeafIds={broadcastTargetLeafIds}
               canBroadcast={canBroadcast}
               onToggleBroadcast={onToggleBroadcast}
               onToggleBroadcastTarget={onToggleBroadcastTarget}
             />
          </ResizablePanel>
        </Fragment>
      ))}
    </ResizablePanelGroup>
  );
}

function paneFocusStyle(color: string): CSSProperties {
  const accent = normalizeHexColor(color) ?? DEFAULT_FOCUS_ACCENT_COLOR;
  return {
    borderColor: accent,
    boxShadow: `inset 0 0 8px ${colorWithAlpha(accent, 0.2)}, 0 0 12px ${colorWithAlpha(accent, 0.35)}`,
  };
}

function normalizeHexColor(color: string): string | null {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : null;
}

function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.slice(1);
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type FloatingTerminalOverlayProps = {
  cwd: string | undefined;
  agentCommand?: string;
  agentResponding: boolean;
  nodeId: number;
  focused: boolean;
  canMaximize: boolean;
  isMaximized: boolean;
  onSplitPane: (dir: SplitDir) => void;
  onToggleMaximize: (leafId: number) => void;
  onCloseLeaf: (leafId: number) => void;
  onCd: (path: string) => void;
  hydrated: boolean;
  onDragStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  isDragging: boolean;
  broadcastEnabled: boolean;
  broadcastTargeted: boolean;
  canBroadcast: boolean;
  onToggleBroadcast: () => void;
  onToggleBroadcastTarget: () => void;
  outputActive: boolean;
};

function AgentResponseLoader() {
  return (
    <span
      aria-label="Agent is responding"
      className="grid size-3.5 shrink-0 grid-cols-2 grid-rows-2 gap-px text-foreground"
      role="status"
    >
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className="cmdspace-agent-response-dot size-1 rounded-[1px] bg-current"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </span>
  );
}

function AgentUsageBadge({ status }: { status: AgentUsageStatus }) {
  const remaining = status.contextRemainingPercent;
  if (remaining === undefined) return null;

  return (
    <span
      className="inline-flex h-5 shrink-0 items-center rounded-sm bg-muted px-1.5 font-mono text-[10px] font-semibold text-foreground dark:bg-zinc-800 dark:text-zinc-100"
      title={`${status.provider === "codex" ? "Codex" : "Claude"} context remaining${status.contextIsEstimated ? " (estimated)" : ""}`}
    >
      {status.contextIsEstimated ? "~" : ""}{remaining}%
    </span>
  );
}

function AgentUsageMenu({ statuses }: { statuses: AgentUsageStatus[] }) {
  return (
    <div className="absolute left-0 top-full z-30 mt-2.5 w-72 rounded-lg border border-border bg-popover/95 p-2 text-left text-popover-foreground shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Coding agent usage
      </div>
      {statuses.length === 0 ? (
        <div className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">
          No local session usage found for this folder yet.
        </div>
      ) : (
        statuses.map((status) => (
          <div key={status.provider} className="border-t border-border/60 px-2 py-2 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold capitalize text-foreground dark:text-zinc-100">{status.provider}</span>
              {status.contextRemainingPercent !== undefined ? (
                <span className="font-mono text-xs font-semibold text-foreground dark:text-zinc-100">
                  {status.contextIsEstimated ? "~" : ""}{status.contextRemainingPercent}% left
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Context window {formatTokenCount(status.contextTokens)} / {formatTokenCount(status.contextWindow)}
              {status.contextIsEstimated ? " · estimated" : ""}
            </div>
            <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Account limits</div>
            {status.rateLimits.length === 0 ? (
              <div className="mt-1 text-[11px] text-muted-foreground">
                Not reported by this local session.
              </div>
            ) : (
              status.rateLimits.map((limit) => (
                <div key={limit.label} className="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span>{limit.label}{limit.windowMinutes ? ` · ${limit.windowMinutes}m` : ""}</span>
                  <span>{limit.usedPercent}% used{formatReset(limit.resetsAt)}</span>
                </div>
              ))
            )}
          </div>
        ))
      )}
      <div className="border-t border-border/60 px-2 pt-2 text-[10px] leading-relaxed text-muted-foreground dark:border-zinc-800">
        Read locally from CLI session logs. No account token is sent to the UI.
      </div>
    </div>
  );
}

function formatTokenCount(value?: number): string {
  if (value === undefined) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatReset(timestamp?: number): string {
  if (!timestamp) return "";
  const reset = new Date(timestamp * 1000);
  if (Number.isNaN(reset.getTime())) return "";
  return ` · resets ${reset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function FloatingTerminalOverlay({
  cwd,
  agentCommand,
  agentResponding,
  nodeId,
  focused,
  canMaximize,
  isMaximized,
  onSplitPane,
  onToggleMaximize,
  onCloseLeaf,
  onCd,
  hydrated,
  onDragStart,
  isDragging,
  broadcastEnabled,
  broadcastTargeted,
  canBroadcast,
  onToggleBroadcast,
  onToggleBroadcastTarget,
  outputActive,
}: FloatingTerminalOverlayProps) {
  const [additions, setAdditions] = useState<number>(0);
  const [deletions, setDeletions] = useState<number>(0);
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const [agentUsage, setAgentUsage] = useState<AgentUsageStatus[]>([]);
  const [usageOpen, setUsageOpen] = useState(false);
  const usageMenuRef = useRef<HTMLDivElement>(null);
  const gitInfoRequestRef = useRef(0);

  const cliAgent = detectCliAgent(agentCommand);
  const supportsUsage = cliAgent === "codex" || cliAgent === "claude";
  const activeAgentUsage = supportsUsage
    ? agentUsage.find((status) => status.provider === cliAgent)
    : undefined;

  useEffect(() => {
    if (!hydrated || !cwd || !supportsUsage) {
      setAgentUsage([]);
      setUsageOpen(false);
      return;
    }

    let disposed = false;
    const refreshAgentUsage = async () => {
      try {
        const statuses = await getAgentUsageStatuses(cwd);
        if (!disposed) setAgentUsage(statuses);
      } catch (error) {
        // Usage telemetry is strictly optional; a terminal must never fail because
        // a local transcript is unavailable or mid-write.
        console.debug("Agent usage snapshot unavailable:", error);
      }
    };

    void refreshAgentUsage();
    const interval = focused ? window.setInterval(refreshAgentUsage, 15_000) : null;
    return () => {
      disposed = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [cwd, focused, hydrated, supportsUsage]);

  const refreshGitInfo = useCallback(async () => {
    const requestId = ++gitInfoRequestRef.current;
    if (!hydrated || !cwd) {
      setRepoRoot(null);
      setAdditions(0);
      setDeletions(0);
      return;
    }

    try {
      const repo = await native.gitResolveRepo(cwd);
      if (requestId !== gitInfoRequestRef.current) return;
      if (!repo) {
        setRepoRoot(null);
        setAdditions(0);
        setDeletions(0);
        return;
      }

      setRepoRoot(repo.repoRoot);

      // Fetch shortstat diff
      let diffText = "";
      try {
        const res = await native.runCommand("git diff HEAD --shortstat", repo.repoRoot);
        if (res.exit_code === 0) {
          diffText = res.stdout;
        } else {
          const resFallback = await native.runCommand("git diff --shortstat", repo.repoRoot);
          if (resFallback.exit_code === 0) {
            diffText = resFallback.stdout;
          }
        }
      } catch {
        // ignore error
      }

      if (requestId !== gitInfoRequestRef.current) return;

      let add = 0;
      let del = 0;
      if (diffText) {
        const addMatch = diffText.match(/(\d+)\s+ins/);
        const delMatch = diffText.match(/(\d+)\s+del/);
        if (addMatch) add = parseInt(addMatch[1], 10);
        if (delMatch) del = parseInt(delMatch[1], 10);
      }
      setAdditions(add);
      setDeletions(del);
    } catch (e) {
      console.warn("Failed to fetch git status:", e);
    }
  }, [cwd, hydrated]);

  useEffect(() => {
    void refreshGitInfo();

    if (!hydrated || !cwd) return;

    // Also set a slow background polling (every 30 seconds) ONLY if the pane is focused,
    // to keep it updated if they leave it idle.
    let interval: NodeJS.Timeout | null = null;
    if (focused) {
      interval = setInterval(refreshGitInfo, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cwd, focused, hydrated, refreshGitInfo]);

  useEffect(() => {
    if (!hydrated || !cwd) return;

    const handleGitRepoChanged = (event: Event) => {
      const changedRepoRoot = gitRepoRootFromChangedEvent(event);
      if (!changedRepoRoot) return;
      if (
        repoRoot === changedRepoRoot ||
        pathBelongsToRepo(cwd, changedRepoRoot)
      ) {
        void refreshGitInfo();
      }
    };

    window.addEventListener(GIT_REPO_CHANGED_EVENT, handleGitRepoChanged);
    return () =>
      window.removeEventListener(GIT_REPO_CHANGED_EVENT, handleGitRepoChanged);
  }, [cwd, hydrated, refreshGitInfo, repoRoot]);

  return (
    <div
      data-pane-drag-handle
      draggable={false}
      onPointerDown={onDragStart}
      className={`absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-3 rounded-none border bg-card/95 px-0 py-0 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-md pointer-events-auto select-none text-muted-foreground dark:bg-zinc-900/90 dark:text-zinc-300 dark:shadow-[0_8px_24px_rgba(0,0,0,0.28)] font-medium text-xs whitespace-nowrap transition-all duration-200 ${
        isDragging ? "cursor-grabbing opacity-60" : "cursor-grab"
      } ${
        focused
          ? "border-border dark:border-zinc-600/90"
          : "border-border/70 dark:border-zinc-800/80"
      } hover:border-border dark:hover:border-zinc-500`}
    >
      {cliAgent ? <AgentCliIcon agent={cliAgent} /> : null}
      {outputActive ? (
        <span
          role="status"
          aria-label="Terminal is producing output"
          className="size-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)]"
        />
      ) : null}
      {cliAgent && agentResponding ? <AgentResponseLoader /> : null}
      {activeAgentUsage ? <AgentUsageBadge status={activeAgentUsage} /> : null}
      {supportsUsage ? (
        <div className="relative" ref={usageMenuRef}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setUsageOpen((open) => !open);
            }}
            className="grid size-5 place-items-center rounded text-[15px] leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label="Show coding agent usage"
            title="Coding agent usage"
          >
            …
          </button>
          {usageOpen ? <AgentUsageMenu statuses={agentUsage} /> : null}
        </div>
      ) : null}
      <TerminalNavigationControls
        cwd={cwd}
        onChangeDirectory={onCd}
        className="hidden @sm:flex"
      />
      {(additions > 0 || deletions > 0) && (
        <div className="hidden @md:flex items-center gap-1 font-bold text-[10px] self-center">
          {additions > 0 && (
            <span className="text-green-500 flex items-center">+{additions}</span>
          )}
          {deletions > 0 && (
            <span className="text-red-500 flex items-center">-{deletions}</span>
          )}
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex items-center gap-1">
        {canBroadcast ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleBroadcastTarget();
              }}
              aria-pressed={broadcastTargeted}
              title={broadcastTargeted ? "Remove pane from broadcast" : "Add pane to broadcast"}
              className={cn(
                "grid size-5.5 place-items-center rounded text-[10px] font-bold transition-colors cursor-default",
                broadcastTargeted
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              T
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleBroadcast();
              }}
              aria-pressed={broadcastEnabled}
              title={broadcastEnabled ? "Disable input broadcast" : "Enable input broadcast"}
              className={cn(
                "grid size-5.5 place-items-center rounded text-[10px] font-bold transition-colors cursor-default",
                broadcastEnabled
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              B
            </button>
          </>
        ) : null}
        {/* Split Vertically (Row) Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSplitPane("row");
          }}
          title="Split Vertically"
          className="grid size-5.5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors cursor-default"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="12" y1="3" x2="12" y2="21" />
          </svg>
        </button>

        {/* Split Horizontally (Col) Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSplitPane("col");
          }}
          title="Split Horizontally"
          className="grid size-5.5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors cursor-default"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="12" x2="21" y2="12" />
          </svg>
        </button>

        {/* Maximize/Restore Button */}
        {canMaximize && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMaximize(nodeId);
            }}
            title={isMaximized ? "Restore Split Layout" : "Maximize Pane"}
            className="grid size-5.5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors cursor-default"
          >
            {isMaximized ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 14h6v6" />
                <path d="M10 14l-6 6" />
                <path d="M20 10h-6V4" />
                <path d="M14 10l6-6" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h6v6" />
                <path d="M9 21H3v-6" />
                <path d="M21 3l-7 7" />
                <path d="M3 21l7-7" />
              </svg>
            )}
          </button>
        )}

        {/* Close Pane Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCloseLeaf(nodeId);
          }}
          title="Close Pane"
          className="grid size-5.5 place-items-center rounded text-muted-foreground hover:bg-red-500/10 hover:text-red-500 dark:text-zinc-400 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-colors cursor-default"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
