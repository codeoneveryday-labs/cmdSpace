import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { native } from "@/modules/ai/lib/native";
import { AgentStateDot, type AgentDisplayState } from "./AgentStateDot";
import { TerminalAgentSwitcher } from "./TerminalAgentSwitcher";
import { TerminalNavigationControls } from "./TerminalNavigationControls";
import type { CliAgent } from "./lib/cliAgents";
import { AgentUsageBadge, useTerminalAgentUsage } from "./TerminalAgentUsage";
import { cn } from "@/lib/utils";
import { GIT_REPO_CHANGED_EVENT, gitRepoRootFromChangedEvent, pathBelongsToRepo } from "@/modules/git/events";
import type { SplitDir } from "./lib/panes";
import { TerminalAgentPermissionPill } from "./TerminalAgentPermissionPill";

type FloatingTerminalOverlayProps = {
  cwd: string | undefined;
  agentCommand?: string;
  agentState?: AgentDisplayState;
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
  onSwitchAgent: (agent: CliAgent | null, command: string | null) => void;
  onWrite?: (data: string) => void;
  onGetBuffer?: (lines?: number) => string | null;
  onGetSessionStartedAt?: () => number | undefined;
  onFocusTerminal?: () => void;
};

export function FloatingTerminalOverlay({
  cwd,
  agentCommand,
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
  onSwitchAgent,
  onWrite,
  onGetBuffer,
  onGetSessionStartedAt,
  onFocusTerminal,
  agentState,
}: FloatingTerminalOverlayProps) {
  const [additions, setAdditions] = useState<number>(0);
  const [deletions, setDeletions] = useState<number>(0);
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const gitInfoRequestRef = useRef(0);

  const { activeAgentUsage, cliAgent } = useTerminalAgentUsage({
    cwd,
    agentCommand,
    focused,
    hydrated,
    getBuffer: onGetBuffer,
    getSessionStartedAt: onGetSessionStartedAt,
    agentState,
  });

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
      className={`relative z-20 flex shrink-0 items-center justify-center gap-1.5 rounded-none border bg-card/95 px-0 py-0 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-md pointer-events-auto select-none text-muted-foreground dark:bg-zinc-900/90 dark:text-zinc-300 dark:shadow-[0_8px_24px_rgba(0,0,0,0.28)] font-medium text-xs whitespace-nowrap transition-all duration-200 @sm:gap-3 ${
        isDragging ? "cursor-grabbing opacity-60" : "cursor-grab"
      } ${
        focused
          ? "border-border dark:border-zinc-600/90"
          : "border-border/70 dark:border-zinc-800/80"
      } hover:border-border dark:hover:border-zinc-500`}
    >
      <TerminalAgentSwitcher
        currentAgent={cliAgent}
        onSelect={onSwitchAgent}
      />
      {/* Compact dir label: only on narrow panes, the full directory +
          branch picker (TerminalNavigationControls) takes over at @sm. */}
      <span
        className="min-w-0 max-w-32 shrink truncate text-xs font-semibold text-foreground @sm:hidden"
        title={cwd ?? undefined}
      >
        {cwd?.replace(/\/$/, "").split("/").pop() || "terminal"}
      </span>
      {agentState ? (
        <span className="hidden @sm:contents">
          <AgentStateDot state={agentState} />
        </span>
      ) : null}
      {activeAgentUsage ? <AgentUsageBadge status={activeAgentUsage} /> : null}
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
      {/* Fast mode & Permission control: only rendered when a CLI Agent is detected */}
      {cliAgent ? (
        <TerminalAgentPermissionPill
          agent={cliAgent}
          onWrite={onWrite}
          onGetBuffer={onGetBuffer}
          onFocusTerminal={onFocusTerminal}
        />
      ) : null}

      {/* Control Buttons */}
      <div className="flex items-center gap-1">
        {canBroadcast ? (
          <span className="hidden @sm:contents">
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
          </span>
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
