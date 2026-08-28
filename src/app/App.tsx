import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FloatingVoiceAgent,
  type FloatingVoiceAgentHandle,
  type SpeechInputTarget,
} from "@/modules/ai/components/FloatingVoiceAgent";
import { AgentChatWorkspace } from "@/modules/ai/components/AgentChatWorkspace";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import type { AgentDisplayState } from "@/modules/terminal/AgentStateDot";
import {
  EMPTY_PROVIDER_KEYS,
  getAllKeys,
  type ProviderKeys,
} from "@/modules/ai/lib/keyring";
import { developerVocabularyFromWorkspace } from "@/modules/ai/lib/developerVocabulary";
import { native } from "@/modules/ai/lib/native";
import {
  ArchitectureStack,
  serializeCanvasWorkspaceDiagram,
  type CanvasTerminalHandle,
} from "@/modules/architecture";
import {
  AiDiffStack,
  EditorStack,
  GitDiffStack,
  NewEditorDialog,
  type EditorPaneHandle,
} from "@/modules/editor";
import {
  GitHistoryStack,
  type GitHistorySearchHandle,
} from "@/modules/git-history";
import { getLaunchDir } from "@/lib/launchDir";
import { useZoom } from "@/lib/useZoom";
import { FileExplorer, type FileExplorerHandle } from "@/modules/explorer";
import {
  Header,
  type SearchInlineHandle,
  type SearchTarget,
} from "@/modules/header";
import { MarkdownStack } from "@/modules/markdown";
import {
  SidebarBrowserPane,
  PreviewStack,
  type PreviewPaneHandle,
} from "@/modules/preview";
import { openSettingsWindow } from "@/modules/settings/openSettingsWindow";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  remoteAccessStart,
  remoteAccessStatus,
} from "@/modules/settings/remoteAccess";
import { onKeysChanged } from "@/modules/settings/store";
import {
  ShortcutsDialog,
  useGlobalShortcuts,
  type ShortcutHandlers,
  type ShortcutId,
} from "@/modules/shortcuts";
import {
  EditorSidebarRail,
  SidebarRail,
  type EditorSidebarViewId,
  type SidebarViewId,
} from "@/modules/sidebar";
import { SourceControlPanel, useSourceControl } from "@/modules/source-control";
import { StatusBar } from "@/modules/statusbar";
import {
  MAX_PANES_PER_TAB,
  TerminalTab,
  useTabs,
  useWorkspaceCwd,
} from "@/modules/tabs";
import type { ArchitectureDiagram } from "@/modules/tabs";
import {
  disposeSession,
  findLeafAutoLaunch,
  findLeafCwd,
  findLeafLastCommand,
  hasLeaf,
  leafIds,
  replaceSessionCommand,
  respawnSession,
  setTerminalResizePaused,
  swapLeafNodes,
  BottomTerminalDrawer,
  TerminalStack,
  type BottomTerminalDrawerHandle,
  type TerminalPaneHandle,
} from "@/modules/terminal";
import {
  clearAgentCompleted,
  useAgentBlockedLeaves,
  useAgentCliCommands,
  useAgentCompletedLeaves,
  useAgentResponseLeaves,
  useAgentResponseRequestedLeaves,
} from "@/modules/terminal/lib/agentActivity";
import {
  detectCliAgent,
  detectTrackedCliAgent,
  type CliAgent,
} from "@/modules/terminal/lib/cliAgents";
import type { PaneNode } from "@/modules/terminal/lib/panes";
import { ThemeProvider } from "@/modules/theme";
import { UpdaterDialog } from "@/modules/updater";
import {
  getWslHome,
  LOCAL_WORKSPACE,
  useWorkspaceEnvStore,
  type WorkspaceEnv,
} from "@/modules/workspace";
import {
  DEFAULT_WORKSPACE_ACCENT_COLOR,
  ImportSessionDialog,
  normalizeWorkspaceAccentColor,
  WORKSPACE_ACCENT_COLORS,
  WorkspacesPanel,
  type WorkspaceTerminalItem,
  WorkspaceSetupView,
  type WorkspaceItem,
  type WorkspaceMode,
  type ImportableAgentSession,
} from "@/modules/workspaces";
import {
  assignSessionsToPanes,
  buildSessionResumeCommand,
  isResumeCommand,
} from "@/modules/workspaces/lib/importSessions";
import { createWorkspaceOpenGate } from "./workspaceOpenGate";
import {
  getWorkspaceLoadingPresentation,
  shouldSuppressBootstrapShell,
} from "./lib/startupGate";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { SearchAddon } from "@xterm/addon-search";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CHROME_RESIZE_TRANSITION_MS,
  ACTIVE_WORKSPACE_STORAGE_KEY,
  SIDEBAR_BROWSER_URL_STORAGE_KEY,
  SIDEBAR_COLLAPSE_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_VIEW_STORAGE_KEY,
  SIDEBAR_WIDTH_STORAGE_KEY,
  WORKSPACE_DELETE_CONFIRM_STORAGE_KEY,
  WORKSPACE_LIMIT,
  WORKSPACE_MIN_WIDTH,
  WORKSPACES_PANEL_COLLAPSE_WIDTH,
  WORKSPACES_PANEL_COMPACT_BREAKPOINT,
  WORKSPACES_PANEL_COMPACT_WIDTH,
  WORKSPACES_PANEL_MAX_WIDTH,
  WORKSPACES_PANEL_MIN_WIDTH,
  WORKSPACES_PANEL_WIDTH,
  WORKSPACES_PANEL_WIDTH_STORAGE_KEY,
} from "./constants";
import { useWorkspacePersistence } from "./lib/useWorkspacePersistence";
import {
  useWorkspaceSelection,
  type WorkspaceSelectionPane,
} from "./lib/useWorkspaceSelection";

function dirname(path: string | null): string | null {
  if (!path) return null;
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return normalized;
  return normalized.slice(0, idx);
}

function canvasTerminalRefKey(tabId: number, terminalId: string): string {
  return `${tabId}:${terminalId}`;
}

function upsertWorkspacePane(
  panes: readonly WorkspaceSelectionPane[],
  pane: WorkspaceSelectionPane,
): WorkspaceSelectionPane[] {
  const next = [...panes];
  const index = next.findIndex((item) => item.paneIndex === pane.paneIndex);
  if (index === -1) next.push(pane);
  else next[index] = pane;
  next.sort((left, right) => left.paneIndex - right.paneIndex);
  return next;
}

type PersistedPaneRecord = WorkspaceSelectionPane & { workspaceId: string };

function paneRecordFromCommand(
  workspaceId: string,
  paneIndex: number,
  workingFolder: string | null,
  lastCommand: string | null,
  autoLaunch: boolean,
  existingPane?: WorkspaceSelectionPane,
  explicitNativeSessionId?: string | null,
  preserveExistingNativeSession = true,
): PersistedPaneRecord {
  if (!autoLaunch || !lastCommand) {
    return {
      workspaceId,
      paneIndex,
      workingFolder,
      lastCommand: null,
      autoLaunch: false,
      agentProvider: null,
      nativeSessionId: null,
    };
  }

  const provider = detectCliAgent(lastCommand);
  if (!provider) {
    return {
      workspaceId,
      paneIndex,
      workingFolder,
      lastCommand,
      autoLaunch,
      agentProvider: existingPane?.agentProvider ?? null,
      nativeSessionId: existingPane?.nativeSessionId ?? null,
    };
  }

  if (explicitNativeSessionId) {
    return {
      workspaceId,
      paneIndex,
      workingFolder,
      lastCommand: buildSessionResumeCommand(provider, explicitNativeSessionId),
      autoLaunch: true,
      agentProvider: provider,
      nativeSessionId: explicitNativeSessionId,
    };
  }

  if (
    preserveExistingNativeSession &&
    existingPane?.nativeSessionId &&
    existingPane.agentProvider === provider &&
    !isResumeCommand(lastCommand)
  ) {
    return {
      workspaceId,
      paneIndex,
      workingFolder,
      lastCommand:
        existingPane.lastCommand ??
        buildSessionResumeCommand(provider, existingPane.nativeSessionId),
      autoLaunch: true,
      agentProvider: provider,
      nativeSessionId: existingPane.nativeSessionId,
    };
  }

  return {
    workspaceId,
    paneIndex,
    workingFolder,
    lastCommand,
    autoLaunch: true,
    agentProvider: provider,
    nativeSessionId: isResumeCommand(lastCommand)
      ? (existingPane?.nativeSessionId ?? null)
      : null,
  };
}

function canvasWorkspaceDiagram(
  terminalCount: number,
  workingFolder: string | null,
  initialCommands: string[],
): ArchitectureDiagram {
  const columns = terminalCount === 1 ? 1 : 2;
  const terminalWidth = 620;
  const terminalHeight = 400;
  const gap = 48;

  return {
    nodes: Array.from({ length: terminalCount }, (_, index) => ({
      id: `workspace-terminal-${index + 1}`,
      kind: "terminal" as const,
      label: `Terminal ${index + 1}`,
      technology: "",
      x: 96 + (index % columns) * (terminalWidth + gap),
      y: 96 + Math.floor(index / columns) * (terminalHeight + gap),
      width: terminalWidth,
      height: terminalHeight,
      ...(workingFolder ? { cwd: workingFolder } : {}),
      ...(initialCommands[index]
        ? { initialCommand: initialCommands[index] }
        : {}),
      terminalChromeVersion: 2 as const,
    })),
    edges: [],
  };
}

type WorkspaceRecord = WorkspaceItem & {
  workingFolder: string | null;
  createdAt: number;
  updatedAt: number;
  displayOrder: number;
  paneLayout: string | null;
  tabId: number | null;
  canvasTabId: number | null;
  agentProvider: CliAgent | null;
  agentSessionId: string | null;
  agentTabIds?: number[];
  agentProviders?: CliAgent[];
  agentSessionIds?: Array<string | null>;
  agentChatIds?: string[];
};

type PersistedWorkspaceRecord = Omit<
  WorkspaceRecord,
  "accentColor" | "tabId" | "canvasTabId" | "agentProvider" | "agentSessionId" | "agentTabIds"
> & {
  accentColor?: string | null;
  agentProvider?: CliAgent | null;
  agentSessionId?: string | null;
  agentProviders?: CliAgent[] | null;
  agentSessionIds?: Array<string | null> | null;
  agentChatIds?: string[] | null;
};

type PersistedRecentWorkspaceRecord = WorkspaceItem & {
  workingFolder: string;
  updatedAt: number;
};

function clampSidebarWidth(width: number, containerWidth?: number): number {
  const maxWidth =
    containerWidth && Number.isFinite(containerWidth)
      ? Math.max(
          SIDEBAR_MIN_WIDTH,
          Math.min(SIDEBAR_MAX_WIDTH, containerWidth - WORKSPACE_MIN_WIDTH),
        )
      : SIDEBAR_MAX_WIDTH;
  return Math.min(maxWidth, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

function shouldUseCompactWorkspacesPanel(width: number): boolean {
  return width < WORKSPACES_PANEL_COMPACT_BREAKPOINT;
}

function clampWorkspacesPanelWidth(
  width: number,
  containerWidth?: number,
  sidebarWidth = 0,
): number {
  const maxWidth =
    containerWidth && Number.isFinite(containerWidth)
      ? Math.max(
          WORKSPACES_PANEL_MIN_WIDTH,
          Math.min(
            WORKSPACES_PANEL_MAX_WIDTH,
            containerWidth - sidebarWidth - WORKSPACE_MIN_WIDTH,
          ),
        )
      : WORKSPACES_PANEL_MAX_WIDTH;
  return Math.min(
    maxWidth,
    Math.max(WORKSPACES_PANEL_MIN_WIDTH, Math.round(width)),
  );
}

function formatWorkspaceName(index: number): string {
  return `workspace-${String(index).padStart(2, "0")}`;
}

function nextWorkspaceName(workspaces: WorkspaceRecord[]): string | null {
  const used = new Set(
    workspaces.flatMap((workspace) => [workspace.id, workspace.name]),
  );
  for (let index = 1; index <= WORKSPACE_LIMIT; index += 1) {
    const name = formatWorkspaceName(index);
    if (!used.has(name)) return name;
  }
  return null;
}

function workspaceAccentForIndex(index: number): string {
  return (
    WORKSPACE_ACCENT_COLORS[index % WORKSPACE_ACCENT_COLORS.length] ??
    DEFAULT_WORKSPACE_ACCENT_COLOR
  );
}

function readSidebarWidth(): number {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    const parsed = stored ? Number.parseInt(stored, 10) : NaN;
    return Number.isFinite(parsed)
      ? clampSidebarWidth(parsed)
      : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

function readWorkspacesPanelWidth(): number {
  try {
    const stored = window.localStorage.getItem(WORKSPACES_PANEL_WIDTH_STORAGE_KEY);
    const parsed = stored ? Number.parseInt(stored, 10) : NaN;
    return Number.isFinite(parsed)
      ? clampWorkspacesPanelWidth(parsed)
      : WORKSPACES_PANEL_WIDTH;
  } catch {
    return WORKSPACES_PANEL_WIDTH;
  }
}

function readSidebarView(): SidebarViewId {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_VIEW_STORAGE_KEY);
    if (stored === "browser" || stored === "editor") {
      return stored;
    }
    if (stored === "explorer") return "editor";
    if (stored === "source-control") return "editor";
  } catch {
    // ignore
  }
  return "browser";
}

function readSkipWorkspaceDeleteConfirm(): boolean {
  try {
    return (
      window.localStorage.getItem(WORKSPACE_DELETE_CONFIRM_STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

function readSidebarBrowserUrl(): string {
  try {
    return window.localStorage.getItem(SIDEBAR_BROWSER_URL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function App() {
  const {
    tabs,
    activeId,
    setActiveId,
    newTab,
    newPrivateTab,
    newWorkspaceTab,
    newAgentChatTab,
    openFileTab,
    pinTab,
    newPreviewTab,
    newMarkdownTab,
    newArchitectureTab,
    openGitDiffTab,
    openCommitHistoryTab,
    openCommitFileDiffTab,
    closeTab,
    updateTab,
    selectByIndex,
    reorderTab,
    setLeafCwd,
    setLeafLaunchCommand,
    setTerminalPaneTree,
    focusPane,
    focusNextPaneInTab,
    splitActivePane,
    appendTerminalPane,
    closeActivePane,
    closePaneByLeaf,
    toggleMaximizePane,
    resetWorkspace,
  } = useTabs(getLaunchDir() ? { cwd: getLaunchDir() } : undefined);

  // Mirror `tabs` into a ref so callbacks scheduled with `setTimeout`
  // (e.g. cdInNewTab) read the latest pane state instead of a stale closure.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const mainShellRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const activeTerminalTab = useMemo(() => {
    const t = tabs.find((x) => x.id === activeId);
    return t && t.kind === "terminal" ? t : null;
  }, [tabs, activeId]);
  const activeLeafId = activeTerminalTab?.activeLeafId ?? null;

  const searchAddons = useRef<Map<number, SearchAddon>>(new Map());
  const [activeSearchAddon, setActiveSearchAddon] =
    useState<SearchAddon | null>(null);
  const searchInlineRef = useRef<SearchInlineHandle | null>(null);
  const terminalRefs = useRef<Map<number, TerminalPaneHandle>>(new Map());
  const bottomTerminalRef = useRef<BottomTerminalDrawerHandle | null>(null);
  const canvasTerminalRefs = useRef<Map<string, CanvasTerminalHandle>>(new Map());
  const activeCanvasTerminalIds = useRef<Map<number, string>>(new Map());
  const [canvasTerminalSelectionVersion, setCanvasTerminalSelectionVersion] = useState(0);
  const pendingVoiceDraftsRef = useRef<Map<number, string>>(new Map());
  const voiceAgentRef = useRef<FloatingVoiceAgentHandle | null>(null);
  const editorRefs = useRef<Map<number, EditorPaneHandle>>(new Map());
  const previewRefs = useRef<Map<number, PreviewPaneHandle>>(new Map());
  const [activeEditorHandle, setActiveEditorHandle] =
    useState<EditorPaneHandle | null>(null);
  const [gitHistoryHandle, setGitHistoryHandle] =
    useState<GitHistorySearchHandle | null>(null);
  const { zoomIn, zoomOut, zoomReset } = useZoom();
  const explorerRef = useRef<FileExplorerHandle>(null);
  const explorerReturnFocusRef = useRef<HTMLElement | null>(null);

  const sidebarSplitRef = useRef<HTMLDivElement | null>(null);
  const sidebarResizeStartRef = useRef<{
    open: boolean;
    pointerX: number;
    width: number;
  } | null>(null);
  const terminalResizeResumeTimerRef = useRef<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [workspacesPanelOpen, setWorkspacesPanelOpen] = useState(true);
  const [workspacesPanelResizing, setWorkspacesPanelResizing] = useState(false);
  const [workspacesPanelExpandedWidth, setWorkspacesPanelExpandedWidth] =
    useState(readWorkspacesPanelWidth);
  const workspacesPanelWidthRef = useRef(workspacesPanelExpandedWidth);
  const workspacesPanelResizeStartRef = useRef<{
    open: boolean;
    pointerX: number;
    width: number;
  } | null>(null);
  const [workspacesPanelCompact, setWorkspacesPanelCompact] = useState(() =>
    typeof window === "undefined"
      ? false
      : shouldUseCompactWorkspacesPanel(window.innerWidth),
  );
  const workspacesPanelWidth = workspacesPanelCompact
    ? WORKSPACES_PANEL_COMPACT_WIDTH
    : workspacesPanelExpandedWidth;
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const sidebarWidthRef = useRef(sidebarWidth);
  const [sidebarView, setSidebarViewState] =
    useState<SidebarViewId>(readSidebarView);
  const [editorSidebarView, setEditorSidebarView] =
    useState<EditorSidebarViewId>("files");
  const [sidebarBrowserUrl, setSidebarBrowserUrl] = useState(
    readSidebarBrowserUrl,
  );
  const persistSidebarView = useCallback((view: SidebarViewId) => {
    setSidebarViewState(view);
    try {
      window.localStorage.setItem(SIDEBAR_VIEW_STORAGE_KEY, view);
    } catch {
      // storage may fail in private mode
    }
  }, []);
  const persistSidebarBrowserUrl = useCallback((url: string) => {
    setSidebarBrowserUrl(url);
    try {
      window.localStorage.setItem(SIDEBAR_BROWSER_URL_STORAGE_KEY, url);
    } catch {
      // storage may fail in private mode
    }
  }, []);
  const clearTerminalResizeResumeTimer = useCallback(() => {
    if (terminalResizeResumeTimerRef.current === null) return;
    window.clearTimeout(terminalResizeResumeTimerRef.current);
    terminalResizeResumeTimerRef.current = null;
  }, []);
  const pauseTerminalResizeForChromeTransition = useCallback(() => {
    clearTerminalResizeResumeTimer();
    setTerminalResizePaused(true);
    terminalResizeResumeTimerRef.current = window.setTimeout(() => {
      terminalResizeResumeTimerRef.current = null;
      requestAnimationFrame(() => {
        if (!sidebarResizeStartRef.current) {
          setTerminalResizePaused(false);
        }
      });
    }, CHROME_RESIZE_TRANSITION_MS);
  }, [clearTerminalResizeResumeTimer]);
  useEffect(() => {
    return () => {
      clearTerminalResizeResumeTimer();
      setTerminalResizePaused(false);
    };
  }, [clearTerminalResizeResumeTimer]);
  const toggleSidebar = useCallback(() => {
    pauseTerminalResizeForChromeTransition();
    setSidebarOpen((open) => !open);
  }, [pauseTerminalResizeForChromeTransition]);
  const toggleWorkspacesPanel = useCallback(() => {
    pauseTerminalResizeForChromeTransition();
    setWorkspacesPanelOpen((open) => !open);
  }, [pauseTerminalResizeForChromeTransition]);
  const canvasFocused = !workspacesPanelOpen && !sidebarOpen;
  const toggleCanvasFocus = useCallback(() => {
    pauseTerminalResizeForChromeTransition();
    if (canvasFocused) {
      setWorkspacesPanelOpen(true);
      setSidebarOpen(true);
      return;
    }
    setWorkspacesPanelOpen(false);
    setSidebarOpen(false);
  }, [canvasFocused, pauseTerminalResizeForChromeTransition]);
  useEffect(() => {
    const shell = mainShellRef.current;
    const updateWorkspacesPanelMode = (width?: number) => {
      const nextWidth =
        width ?? shell?.getBoundingClientRect().width ?? window.innerWidth;
      setWorkspacesPanelCompact(shouldUseCompactWorkspacesPanel(nextWidth));
      const clampedWidth = clampWorkspacesPanelWidth(
        workspacesPanelWidthRef.current,
        nextWidth,
        sidebarOpen ? sidebarWidthRef.current : 0,
      );
      if (clampedWidth !== workspacesPanelWidthRef.current) {
        workspacesPanelWidthRef.current = clampedWidth;
        setWorkspacesPanelExpandedWidth(clampedWidth);
      }
    };

    updateWorkspacesPanelMode();
    const onWindowResize = () => updateWorkspacesPanelMode();

    if (!shell || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", onWindowResize);
      return () => {
        window.removeEventListener("resize", onWindowResize);
      };
    }

    const resizeObserver = new ResizeObserver((entries) => {
      updateWorkspacesPanelMode(entries[0]?.contentRect.width);
    });
    resizeObserver.observe(shell);

    window.addEventListener("resize", onWindowResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
  }, [sidebarOpen]);
  const cycleSidebarView = useCallback(
    (view: SidebarViewId) => {
      if (view !== sidebarView) {
        if (!sidebarOpen) pauseTerminalResizeForChromeTransition();
        setSidebarOpen(true);
        persistSidebarView(view);
        return;
      }
      pauseTerminalResizeForChromeTransition();
      setSidebarOpen((open) => !open);
    },
    [
      pauseTerminalResizeForChromeTransition,
      persistSidebarView,
      sidebarOpen,
      sidebarView,
    ],
  );
  const rememberSidebarWidth = useCallback((next: number) => {
    const containerWidth =
      sidebarSplitRef.current?.getBoundingClientRect().width;
    const width = clampSidebarWidth(next, containerWidth);
    sidebarWidthRef.current = width;
    setSidebarWidth(width);
  }, []);
  const persistRememberedSidebarWidth = useCallback(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_WIDTH_STORAGE_KEY,
        String(sidebarWidthRef.current),
      );
    } catch {
      // ignore
    }
  }, []);
  const rememberWorkspacesPanelWidth = useCallback(
    (next: number) => {
      const containerWidth = mainShellRef.current?.getBoundingClientRect().width;
      const width = clampWorkspacesPanelWidth(
        next,
        containerWidth,
        sidebarOpen ? sidebarWidthRef.current : 0,
      );
      workspacesPanelWidthRef.current = width;
      setWorkspacesPanelExpandedWidth(width);
    },
    [sidebarOpen],
  );
  const persistRememberedWorkspacesPanelWidth = useCallback(() => {
    try {
      window.localStorage.setItem(
        WORKSPACES_PANEL_WIDTH_STORAGE_KEY,
        String(workspacesPanelWidthRef.current),
      );
    } catch {
      // ignore
    }
  }, []);
  const resumeTerminalResizeAfterSidebarDrag = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (
          !sidebarResizeStartRef.current &&
          !workspacesPanelResizeStartRef.current
        ) {
          setTerminalResizePaused(false);
        }
      });
    });
  }, []);
  const collapseWorkspacesPanelFromResize = useCallback(() => {
    workspacesPanelResizeStartRef.current = null;
    setWorkspacesPanelOpen(false);
    persistRememberedWorkspacesPanelWidth();
    resumeTerminalResizeAfterSidebarDrag();
    requestAnimationFrame(() => setWorkspacesPanelResizing(false));
  }, [
    persistRememberedWorkspacesPanelWidth,
    resumeTerminalResizeAfterSidebarDrag,
  ]);
  const collapseSidebarFromResize = useCallback(() => {
    sidebarResizeStartRef.current = null;
    setSidebarOpen(false);
    persistRememberedSidebarWidth();
    resumeTerminalResizeAfterSidebarDrag();
    requestAnimationFrame(() => setSidebarResizing(false));
  }, [persistRememberedSidebarWidth, resumeTerminalResizeAfterSidebarDrag]);
  const handleWorkspacesPanelResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (workspacesPanelCompact) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      clearTerminalResizeResumeTimer();
      setTerminalResizePaused(true);
      workspacesPanelResizeStartRef.current = {
        open: workspacesPanelOpen,
        pointerX: event.clientX,
        width: workspacesPanelOpen ? workspacesPanelWidthRef.current : 0,
      };
      setWorkspacesPanelResizing(true);
    },
    [clearTerminalResizeResumeTimer, workspacesPanelCompact, workspacesPanelOpen],
  );
  const handleWorkspacesPanelResizeMove = useCallback(
    (event: PointerEvent) => {
      const start = workspacesPanelResizeStartRef.current;
      if (!start || workspacesPanelCompact) return;
      event.preventDefault();
      const nextWidth = start.width + (event.clientX - start.pointerX);
      const reopeningPanel = !start.open;
      if (reopeningPanel) {
        if (nextWidth > WORKSPACES_PANEL_COLLAPSE_WIDTH) {
          setWorkspacesPanelOpen(true);
          rememberWorkspacesPanelWidth(nextWidth);
        }
        return;
      }
      if (nextWidth <= WORKSPACES_PANEL_COLLAPSE_WIDTH) {
        collapseWorkspacesPanelFromResize();
        return;
      }
      rememberWorkspacesPanelWidth(nextWidth);
    },
    [
      collapseWorkspacesPanelFromResize,
      rememberWorkspacesPanelWidth,
      workspacesPanelCompact,
    ],
  );
  const handleWorkspacesPanelResizeEnd = useCallback(() => {
    if (!workspacesPanelResizeStartRef.current) return;
    workspacesPanelResizeStartRef.current = null;
    setWorkspacesPanelResizing(false);
    persistRememberedWorkspacesPanelWidth();
    resumeTerminalResizeAfterSidebarDrag();
  }, [
    persistRememberedWorkspacesPanelWidth,
    resumeTerminalResizeAfterSidebarDrag,
  ]);
  const handleSidebarResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      clearTerminalResizeResumeTimer();
      setTerminalResizePaused(true);
      sidebarResizeStartRef.current = {
        open: sidebarOpen,
        pointerX: event.clientX,
        width: sidebarOpen ? sidebarWidthRef.current : 0,
      };
      setSidebarResizing(true);
    },
    [clearTerminalResizeResumeTimer, sidebarOpen],
  );
  const handleSidebarResizeMove = useCallback(
    (event: PointerEvent) => {
      const start = sidebarResizeStartRef.current;
      if (!start) return;
      event.preventDefault();
      const nextWidth = start.width - (event.clientX - start.pointerX);
      const reopeningSidebar = !start.open;
      if (reopeningSidebar) {
        if (nextWidth > SIDEBAR_COLLAPSE_WIDTH) {
          setSidebarOpen(true);
          rememberSidebarWidth(nextWidth);
        }
        return;
      }
      if (nextWidth <= SIDEBAR_COLLAPSE_WIDTH) {
        collapseSidebarFromResize();
        return;
      }
      rememberSidebarWidth(nextWidth);
    },
    [collapseSidebarFromResize, rememberSidebarWidth],
  );
  const handleSidebarResizeEnd = useCallback(() => {
    if (!sidebarResizeStartRef.current) return;
    sidebarResizeStartRef.current = null;
    setSidebarResizing(false);
    persistRememberedSidebarWidth();
    resumeTerminalResizeAfterSidebarDrag();
  }, [persistRememberedSidebarWidth, resumeTerminalResizeAfterSidebarDrag]);
  useEffect(() => {
    if (!workspacesPanelResizing) return;
    window.addEventListener("pointermove", handleWorkspacesPanelResizeMove);
    window.addEventListener("pointerup", handleWorkspacesPanelResizeEnd);
    window.addEventListener("pointercancel", handleWorkspacesPanelResizeEnd);
    window.addEventListener("blur", handleWorkspacesPanelResizeEnd);
    return () => {
      window.removeEventListener("pointermove", handleWorkspacesPanelResizeMove);
      window.removeEventListener("pointerup", handleWorkspacesPanelResizeEnd);
      window.removeEventListener("pointercancel", handleWorkspacesPanelResizeEnd);
      window.removeEventListener("blur", handleWorkspacesPanelResizeEnd);
    };
  }, [
    handleWorkspacesPanelResizeEnd,
    handleWorkspacesPanelResizeMove,
    workspacesPanelResizing,
  ]);
  useEffect(() => {
    if (!sidebarResizing) return;
    window.addEventListener("pointermove", handleSidebarResizeMove);
    window.addEventListener("pointerup", handleSidebarResizeEnd);
    window.addEventListener("pointercancel", handleSidebarResizeEnd);
    window.addEventListener("blur", handleSidebarResizeEnd);
    return () => {
      window.removeEventListener("pointermove", handleSidebarResizeMove);
      window.removeEventListener("pointerup", handleSidebarResizeEnd);
      window.removeEventListener("pointercancel", handleSidebarResizeEnd);
      window.removeEventListener("blur", handleSidebarResizeEnd);
    };
  }, [handleSidebarResizeEnd, handleSidebarResizeMove, sidebarResizing]);
  const nudgeWorkspacesPanelWidth = useCallback(
    (delta: number) => {
      if (workspacesPanelCompact) return;
      const nextWidth = (workspacesPanelOpen ? workspacesPanelWidth : 0) + delta;
      if (nextWidth <= WORKSPACES_PANEL_COLLAPSE_WIDTH) {
        setWorkspacesPanelOpen(false);
        persistRememberedWorkspacesPanelWidth();
        return;
      }
      setWorkspacesPanelOpen(true);
      rememberWorkspacesPanelWidth(nextWidth);
      persistRememberedWorkspacesPanelWidth();
    },
    [
      persistRememberedWorkspacesPanelWidth,
      rememberWorkspacesPanelWidth,
      workspacesPanelCompact,
      workspacesPanelOpen,
      workspacesPanelWidth,
    ],
  );
  const handleWorkspacesPanelResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (workspacesPanelCompact) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeWorkspacesPanelWidth(-16);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeWorkspacesPanelWidth(16);
      } else if (event.key === "Home") {
        event.preventDefault();
        setWorkspacesPanelOpen(true);
        rememberWorkspacesPanelWidth(WORKSPACES_PANEL_MIN_WIDTH);
        persistRememberedWorkspacesPanelWidth();
      } else if (event.key === "End") {
        event.preventDefault();
        setWorkspacesPanelOpen(true);
        rememberWorkspacesPanelWidth(WORKSPACES_PANEL_MAX_WIDTH);
        persistRememberedWorkspacesPanelWidth();
      }
    },
    [
      nudgeWorkspacesPanelWidth,
      persistRememberedWorkspacesPanelWidth,
      rememberWorkspacesPanelWidth,
      workspacesPanelCompact,
    ],
  );
  const handleSidebarResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSidebarOpen(true);
        rememberSidebarWidth((sidebarOpen ? sidebarWidth : 0) + 16);
        persistRememberedSidebarWidth();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        const nextWidth = (sidebarOpen ? sidebarWidth : 0) - 16;
        if (nextWidth <= SIDEBAR_COLLAPSE_WIDTH) {
          setSidebarOpen(false);
          persistRememberedSidebarWidth();
          return;
        }
        setSidebarOpen(true);
        rememberSidebarWidth(nextWidth);
        persistRememberedSidebarWidth();
      } else if (event.key === "Home") {
        event.preventDefault();
        setSidebarOpen(true);
        rememberSidebarWidth(SIDEBAR_MIN_WIDTH);
        persistRememberedSidebarWidth();
      } else if (event.key === "End") {
        event.preventDefault();
        setSidebarOpen(true);
        rememberSidebarWidth(SIDEBAR_MAX_WIDTH);
        persistRememberedSidebarWidth();
      }
    },
    [
      persistRememberedSidebarWidth,
      rememberSidebarWidth,
      sidebarOpen,
      sidebarWidth,
    ],
  );

  const toggleExplorerFocus = useCallback(() => {
    const explorer = explorerRef.current;
    if (sidebarView !== "editor" || !sidebarOpen) {
      if (!sidebarOpen) setSidebarOpen(true);
      if (sidebarView !== "editor") persistSidebarView("editor");
      const active = document.activeElement;
      explorerReturnFocusRef.current =
        active instanceof HTMLElement && active !== document.body
          ? active
          : null;
      requestAnimationFrame(() => explorerRef.current?.focus());
      return;
    }
    if (!explorer) return;
    if (explorer.isFocused()) {
      const target = explorerReturnFocusRef.current;
      explorerReturnFocusRef.current = null;
      if (target && document.body.contains(target)) {
        target.focus();
      } else {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      return;
    }
    const active = document.activeElement;
    explorerReturnFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    explorer.focus();
  }, [persistSidebarView, sidebarOpen, sidebarView]);

  const [home, setHome] = useState<string | null>(null);
  const [pendingCloseTab, setPendingCloseTab] = useState<number | null>(null);
  const [pendingDeleteWorkspaceId, setPendingDeleteWorkspaceId] = useState<
    string | null
  >(null);
  const [skipWorkspaceDeleteConfirm, setSkipWorkspaceDeleteConfirm] = useState(
    readSkipWorkspaceDeleteConfirm,
  );
  const [workspaceDeleteDoNotAskAgain, setWorkspaceDeleteDoNotAskAgain] =
    useState(false);
  const workspaceEnv = useWorkspaceEnvStore((s) => s.env);
  const setWorkspaceEnv = useWorkspaceEnvStore((s) => s.setEnv);
  const [launchCwd, setLaunchCwd] = useState<string | null>(null);
  const [launchCwdResolved, setLaunchCwdResolved] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [openingWorkspaceId, setOpeningWorkspaceId] = useState<string | null>(null);
  const [persistedWorkspacePanes, setPersistedWorkspacePanes] = useState<
    Record<string, WorkspaceSelectionPane[]>
  >({});
  const persistedWorkspacePanesRef = useRef(persistedWorkspacePanes);
  persistedWorkspacePanesRef.current = persistedWorkspacePanes;
  const reservedNativeSessionIdsRef = useRef<Map<string, string>>(new Map());
  const workspacePaneLaunchAtRef = useRef<Map<string, number>>(new Map());
  const workspacePaneSyncTimersRef = useRef<Map<string, number[]>>(new Map());
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceItem[]>([]);
  const [workspaceSetupOpen, setWorkspaceSetupOpen] = useState(false);
  const [workspaceForkContext, setWorkspaceForkContext] = useState<{
    provider: CliAgent;
    cwd: string;
    attachment: AgentChatHistoryAttachment;
  } | null>(null);
  const [workspacesHydrated, setWorkspacesHydrated] = useState(false);
  const [importSessionOpen, setImportSessionOpen] = useState(false);
  const workspacesRef = useRef(workspaces);
  const workspaceOpenGateRef = useRef(createWorkspaceOpenGate());
  const workspaceSelectionRequestRef = useRef(0);
  const initialWorkspaceActivationHandledRef = useRef(false);
  const pendingBootstrapCloseRef = useRef(false);
  const pendingWorkspaceTerminalRef = useRef<{ workspaceId: string; leafId: number } | null>(null);
  const persistCanvasDiagramRef = useRef<
    ((tabId: number, diagram: ArchitectureDiagram) => void) | null
  >(null);
  const canvasTerminalCreatorRef = useRef(
    new Map<number, (initialCommand?: string) => boolean>(),
  );
  useEffect(() => {
    workspacesRef.current = workspaces;
  }, [workspaces]);

  const setPersistedPaneRecord = useCallback(
    (pane: PersistedPaneRecord) => {
      const { workspaceId, ...persistedPane } = pane;
      setPersistedWorkspacePanes((current) => ({
        ...current,
        [workspaceId]: upsertWorkspacePane(
          current[workspaceId] ?? [],
          persistedPane,
        ),
      }));
    },
    [],
  );

  const persistedPaneFor = useCallback(
    (workspaceId: string, paneIndex: number) =>
      persistedWorkspacePanesRef.current[workspaceId]?.find(
        (pane) => pane.paneIndex === paneIndex,
      ),
    [],
  );

  const persistPaneRecord = useCallback(
    async (pane: PersistedPaneRecord) => {
      setPersistedPaneRecord(pane);
      await invoke("db_save_pane", { pane });
    },
    [setPersistedPaneRecord],
  );

  useEffect(() => {
    if (workspacesHydrated && workspaces.length === 0) {
      setWorkspaceSetupOpen(true);
    }
  }, [workspacesHydrated, workspaces.length]);

  const saveRecentWorkspace = useCallback((workspace: WorkspaceItem) => {
    if (!workspace.workingFolder) return;
    const recent = {
      id: workspace.id,
      name: workspace.name,
      count: workspace.count,
      accentColor: workspace.accentColor,
      workingFolder: workspace.workingFolder,
      updatedAt: Date.now(),
    };
    setRecentWorkspaces((current) =>
      [recent, ...current.filter((item) => item.id !== recent.id)].slice(0, 6),
    );
    invoke("db_save_recent_workspace", { workspace: recent }).catch((err) => {
      console.error("Failed to save recent workspace to SQLite:", err);
    });
  }, []);

  const syncWorkspacePaneNativeSessions = useCallback(
    async (workspaceId: string, workspaceCwd: string | null) => {
      if (!workspaceCwd) return [] as WorkspaceSelectionPane[];
      const [panes, sessions] = await Promise.all([
        invoke<WorkspaceSelectionPane[]>("db_list_panes", { workspaceId }),
        invoke<ImportableAgentSession[]>("list_agent_sessions", {
          limit: 500,
          workspaceCwd,
        }),
      ]);
      const claimedSessionIds = Object.entries(
        persistedWorkspacePanesRef.current,
      )
        .filter(([id]) => id !== workspaceId)
        .flatMap(([, workspacePanes]) =>
          workspacePanes
            .map((pane) => pane.nativeSessionId)
            .filter((value): value is string => Boolean(value)),
        );
      for (const [sessionId, ownerWorkspaceId] of reservedNativeSessionIdsRef.current) {
        if (ownerWorkspaceId !== workspaceId && !claimedSessionIds.includes(sessionId)) {
          claimedSessionIds.push(sessionId);
        }
      }
      const resolvedPanes = assignSessionsToPanes(
        panes,
        sessions,
        workspaceCwd,
        claimedSessionIds,
        new Map(
          panes
            .map((pane) => [
              pane.paneIndex,
              workspacePaneLaunchAtRef.current.get(`${workspaceId}:${pane.paneIndex}`),
            ] as const)
            .filter((entry): entry is readonly [number, number] => entry[1] !== undefined),
        ),
      );
      for (const pane of resolvedPanes) {
        if (pane.nativeSessionId) {
          reservedNativeSessionIdsRef.current.set(pane.nativeSessionId, workspaceId);
        }
      }
      const changedPanes = resolvedPanes.filter((pane, index) => {
        const previous = panes[index];
        return (
          pane.lastCommand !== previous?.lastCommand ||
          pane.agentProvider !== previous?.agentProvider ||
          pane.nativeSessionId !== previous?.nativeSessionId
        );
      });
      if (changedPanes.length === 0) {
        setPersistedWorkspacePanes((current) => ({
          ...current,
          [workspaceId]: resolvedPanes,
        }));
        return resolvedPanes;
      }
      await Promise.all(
        changedPanes.map((pane) =>
          persistPaneRecord({
            workspaceId,
            paneIndex: pane.paneIndex,
            workingFolder: pane.workingFolder ?? workspaceCwd,
            lastCommand: pane.lastCommand,
            autoLaunch: pane.autoLaunch,
            agentProvider: pane.agentProvider ?? null,
            nativeSessionId: pane.nativeSessionId ?? null,
          }),
        ),
      );
      return resolvedPanes;
    },
    [persistPaneRecord],
  );

  const scheduleWorkspacePaneSessionSync = useCallback(
    (workspaceId: string, workspaceCwd: string | null) => {
      if (!workspaceCwd) return;
      const current = workspacePaneSyncTimersRef.current.get(workspaceId) ?? [];
      for (const timer of current) window.clearTimeout(timer);
      const runAfter = [1_200, 4_000];
      const timers = runAfter.map((delay) =>
        window.setTimeout(() => {
          void syncWorkspacePaneNativeSessions(workspaceId, workspaceCwd).catch(
            (error) => {
              console.error("Failed to sync workspace pane native sessions:", error);
            },
          );
        }, delay),
      );
      workspacePaneSyncTimersRef.current.set(workspaceId, timers);
    },
    [syncWorkspacePaneNativeSessions],
  );

  useEffect(() => {
    return () => {
      for (const timers of workspacePaneSyncTimersRef.current.values()) {
        for (const timer of timers) window.clearTimeout(timer);
      }
      workspacePaneSyncTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    invoke<PersistedWorkspaceRecord[]>("db_list_workspaces")
      .then((list) => {
        // Set tabId to null on startup for all records
        const hydrated = list.map((w, index): WorkspaceRecord => ({
          ...w,
          accentColor: normalizeWorkspaceAccentColor(
            w.accentColor,
            workspaceAccentForIndex(index),
          ),
          paneLayout: w.paneLayout ?? null,
          tabId: null,
          canvasTabId: null,
          workspaceMode:
            w.workspaceMode === "canvas"
              ? "canvas"
              : w.workspaceMode === "agent"
                ? "agent"
                : "standard",
          agentProvider: w.agentProvider ?? null,
          agentSessionId: w.agentSessionId ?? null,
          agentTabIds: [],
          agentProviders: w.agentProviders ?? [],
          agentSessionIds: w.agentSessionIds ?? [],
          agentChatIds: w.agentChatIds ?? [],
        }));
        setWorkspaces(hydrated);
        setWorkspacesHydrated(true);
        void Promise.all(
          hydrated.map(async (workspace) => {
            try {
              const panes = await invoke<WorkspaceSelectionPane[]>(
                "db_list_panes",
                { workspaceId: workspace.id },
              );
              return [workspace.id, panes] as const;
            } catch {
              return [workspace.id, []] as const;
            }
          }),
        ).then((entries) => setPersistedWorkspacePanes(Object.fromEntries(entries)));
        if (hydrated.length === 0) setWorkspaceSetupOpen(true);
      })
      .catch((err) => {
        console.error("Failed to load workspaces from SQLite:", err);
      });
    invoke<PersistedRecentWorkspaceRecord[]>("db_list_recent_workspaces")
      .then((list) => {
        setRecentWorkspaces(
          list.map((workspace, index) => ({
            ...workspace,
            accentColor: normalizeWorkspaceAccentColor(
              workspace.accentColor,
              workspaceAccentForIndex(index),
            ),
          })),
        );
      })
      .catch((err) => {
        console.error("Failed to load recent workspaces from SQLite:", err);
      });
  }, []);
  const [pendingDeleteTabs, setPendingDeleteTabs] = useState<number[] | null>(
    null,
  );
  useEffect(() => {
    homeDir()
      .then(async (p) => {
        const normalized = p.replace(/\\/g, "/");
        setHome(normalized);
        try {
          await native.workspaceAuthorize(normalized);
        } catch {
          // Bootstrap already authorizes home from Rust; ignore.
        }
      })
      .catch(() => setHome(null));
  }, []);

  const switchWorkspace = useCallback(
    async (env: WorkspaceEnv) => {
      if (
        env.kind === workspaceEnv.kind &&
        (env.kind === "local" ||
          (workspaceEnv.kind === "wsl" && env.distro === workspaceEnv.distro))
      ) {
        return;
      }
      const dirty = tabsRef.current.some((t) => t.kind === "editor" && t.dirty);
      if (dirty) {
        window.alert(
          "Save or close unsaved editor tabs before switching workspace.",
        );
        return;
      }

      let nextHome: string | null = null;
      try {
        if (env.kind === "wsl") {
          nextHome = await getWslHome(env.distro);
        } else {
          nextHome = (await homeDir()).replace(/\\/g, "/");
        }
      } catch (e) {
        window.alert(String(e));
        return;
      }

      for (const id of liveLeavesRef.current) disposeSession(id);
      searchAddons.current.clear();
      terminalRefs.current.clear();
      editorRefs.current.clear();
      previewRefs.current.clear();
      setActiveSearchAddon(null);
      setActiveEditorHandle(null);
      setWorkspaceEnv(env.kind === "local" ? LOCAL_WORKSPACE : env);
      setHome(nextHome);
      setLaunchCwd(nextHome);
      if (nextHome) {
        try {
          await native.workspaceAuthorize(nextHome);
        } catch {
          // Non-fatal — git panel will surface "not authorized" if needed.
        }
      }
      setWorkspaces((current) =>
        current.map((workspace) => ({
          ...workspace,
          tabId: null,
          canvasTabId: null,
        })),
      );
      resetWorkspace(nextHome ?? undefined);
    },
    [workspaceEnv, setWorkspaceEnv, resetWorkspace],
  );
  useEffect(() => {
    native
      .workspaceCurrentDir()
      .then(setLaunchCwd)
      .catch(() => setLaunchCwd(null))
      .finally(() => setLaunchCwdResolved(true));
  }, []);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [newEditorOpen, setNewEditorOpen] = useState(false);
  const [bottomTerminalOpen, setBottomTerminalOpen] = useState(false);
  const [bottomTerminalCwd, setBottomTerminalCwd] = useState<string | null>(
    null,
  );
  const [apiKeys, setApiKeys] = useState<ProviderKeys>(EMPTY_PROVIDER_KEYS);

  useEffect(() => {
    let alive = true;
    const reload = () => {
      void getAllKeys().then((keys) => {
        if (!alive) return;
        setApiKeys(keys);
      });
    };
    reload();
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    const unlistenP = onKeysChanged(reload);
    return () => {
      alive = false;
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
      void unlistenP.then((fn) => fn());
    };
  }, [setApiKeys]);

  const initPrefs = usePreferencesStore((s) => s.init);
  const prefsHydrated = usePreferencesStore((s) => s.hydrated);
  const remoteAccessEnabled = usePreferencesStore((s) => s.remoteAccessEnabled);
  useEffect(() => {
    void initPrefs();
  }, [initPrefs]);
  useEffect(() => {
    if (!prefsHydrated || !remoteAccessEnabled) return;
    let alive = true;
    void remoteAccessStatus()
      .then((status) => {
        if (!alive) return;
        if (!status.enabled) {
          void remoteAccessStart().catch((error) => {
            console.error("remote access auto-start failed", error);
          });
        }
      })
      .catch(() => {
        if (!alive) return;
        void remoteAccessStart().catch((error) => {
          console.error("remote access auto-start failed", error);
        });
      });
    return () => {
      alive = false;
    };
  }, [prefsHydrated, remoteAccessEnabled]);

  const activeTab = tabs.find((t) => t.id === activeId);
  const activeWorkspace = workspaces.find(
    (workspace) =>
      workspace.tabId === activeId ||
      workspace.canvasTabId === activeId ||
      workspace.agentTabIds?.includes(activeId),
  );
  const activeWorkspaceId = activeWorkspace?.id ?? null;
  const activeWorkspaceFolder = activeWorkspace?.workingFolder ?? null;
  const agentCommands = useAgentCliCommands();
  const respondingLeaves = useAgentResponseLeaves();
  const requestedLeaves = useAgentResponseRequestedLeaves();
  const blockedLeaves = useAgentBlockedLeaves();
  const completedLeaves = useAgentCompletedLeaves();
  const activeWorkspaceCodingAgentCount =
    activeTab?.kind === "terminal"
      ? leafIds(activeTab.paneTree).filter((leafId) =>
          Boolean(
            detectTrackedCliAgent(
              agentCommands.get(leafId),
              findLeafLastCommand(activeTab.paneTree, leafId),
            ),
          ),
        ).length
      : 0;
  const activeWorkspaceTerminals = useMemo<WorkspaceTerminalItem[]>(() => {
    if (activeTab?.kind !== "terminal") return [];
    return leafIds(activeTab.paneTree)
      .map((leafId, index): WorkspaceTerminalItem => {
        const trackedCommand = agentCommands.get(leafId);
        const savedCommand = findLeafLastCommand(activeTab.paneTree, leafId);
        const command = trackedCommand ?? savedCommand;
        const agent = detectTrackedCliAgent(trackedCommand, savedCommand);
          return {
            leafId,
            cwd: findLeafCwd(activeTab.paneTree, leafId) ?? activeTab.cwd ?? null,
            label: command ?? (agent ?? `Terminal ${index + 1}`),
            onClose: () => closePaneByLeaf(leafId),
            ...(agent ? { agent } : {}),
          active: leafId === activeLeafId,
          responding: respondingLeaves.has(leafId),
          completed: completedLeaves.has(leafId),
          state: (blockedLeaves.has(leafId)
            ? "blocked"
            : requestedLeaves.has(leafId) || respondingLeaves.has(leafId)
              ? "working"
                : completedLeaves.has(leafId)
                  ? "done"
                  : undefined) as AgentDisplayState | undefined,
        };
      });
  }, [
    activeLeafId,
    activeTab,
    agentCommands,
    blockedLeaves,
    completedLeaves,
    respondingLeaves,
    requestedLeaves,
  ]);
  const activeWorkspaceAccentColor = activeWorkspace?.accentColor ?? "#0088ff";
  const pendingDeleteWorkspace =
    pendingDeleteWorkspaceId === null
      ? null
      : (workspaces.find(
          (workspace) => workspace.id === pendingDeleteWorkspaceId,
        ) ?? null);
  const workspaceItems = useMemo(
    () =>
      workspaces.map((workspace) => {
        const workspaceTab = tabs.find((item) => item.id === workspace.tabId);
        const liveWorkingFolder = workspace.workingFolder
          ?? (workspaceTab?.kind === "terminal"
            ? findLeafCwd(workspaceTab.paneTree, workspaceTab.activeLeafId) ?? workspaceTab.cwd ?? null
            : workspaceTab?.kind === "agent-chat"
              ? workspaceTab.cwd
              : null);
        if (workspace.id === activeWorkspaceId && activeWorkspaceTerminals.length > 0) {
          const state = (activeWorkspaceTerminals.find(
            (terminal) => terminal.state === "blocked",
          )
            ? "blocked"
            : activeWorkspaceTerminals.find(
                  (terminal) => terminal.state === "working",
                )
              ? "working"
              : activeWorkspaceTerminals.find(
                    (terminal) => terminal.state === "done",
                  )
                ? "done"
                : undefined) as AgentDisplayState | undefined;
          return {
            ...workspace,
            workingFolder: liveWorkingFolder,
            count: activeWorkspaceTerminals.length,
            terminals: activeWorkspaceTerminals,
            responding: activeWorkspaceTerminals.some(
              (terminal) => terminal.responding,
            ),
            state,
          };
        }
        const tab = workspaceTab;
        const canvasTab = workspace.canvasTabId === null
          ? undefined
          : tabs.find((item) => item.id === workspace.canvasTabId);
        if (workspace.workspaceMode === "canvas" && canvasTab?.kind === "architecture") {
          const activeCanvasId = activeCanvasTerminalIds.current.get(canvasTab.id);
          const terminals = canvasTab.diagram?.nodes
            .filter((node) => node.kind === "terminal")
            .map((node, index): WorkspaceTerminalItem => {
              const command = node.initialCommand ?? null;
              const agent = detectTrackedCliAgent(command ?? undefined, command ?? undefined);
              return {
                leafId: -(index + 1),
                cwd: node.cwd ?? workspace.workingFolder ?? null,
                label: command ?? `Terminal ${index + 1}`,
                onClose: () =>
                  canvasTerminalRefs.current.get(
                    canvasTerminalRefKey(canvasTab.id, node.id),
                  )?.close(),
                ...(agent ? { agent } : {}),
                active: node.id === activeCanvasId,
                responding: false,
                completed: false,
              };
            }) ?? [];
          return { ...workspace, workingFolder: liveWorkingFolder, count: terminals.length, terminals };
        }
        const agentTabs = tabs.filter(
          (item) =>
            item.kind === "agent-chat" &&
            (item.id === workspace.tabId || workspace.agentTabIds?.includes(item.id)),
        );
        if (workspace.workspaceMode === "agent" && agentTabs.length > 0) {
          const terminals = agentTabs.map((agentTab, index) => {
            if (agentTab.kind !== "agent-chat") {
              return {
                leafId: -(index + 1),
                label: `Agent ${index + 1}`,
                active: agentTab.id === activeId,
                responding: false,
                completed: false,
              } satisfies WorkspaceTerminalItem;
            }
            return {
              leafId: -(index + 1),
              cwd: agentTab.cwd,
              tabId: agentTab.id,
              label: agentTab.title,
              onClose: () => handleClose(agentTab.id),
              agent: agentTab.provider,
              active: agentTab.id === activeId,
              responding: false,
              completed: false,
            } satisfies WorkspaceTerminalItem;
          });
          return { ...workspace, workingFolder: liveWorkingFolder, count: terminals.length, terminals };
        }
        if (workspace.workspaceMode === "agent") {
          return { ...workspace, workingFolder: liveWorkingFolder, count: agentTabs.length, terminals: [] };
        }
        if (!tab || tab.kind !== "terminal") {
          const persistedPanes = persistedWorkspacePanes[workspace.id] ?? [];
          const count = Math.max(workspace.count, persistedPanes.length);
          const terminals: WorkspaceTerminalItem[] = Array.from(
            { length: count },
            (_, index) => {
              const pane = persistedPanes[index];
              const command = pane?.autoLaunch ? pane.lastCommand : null;
              const agent = detectTrackedCliAgent(command ?? undefined, command ?? undefined);
              return {
                leafId: -(index + 1),
                cwd: pane?.workingFolder ?? workspace.workingFolder ?? null,
                label: command ?? (agent ?? `Terminal ${index + 1}`),
                ...(agent ? { agent } : {}),
                active: false,
                responding: false,
                completed: false,
              };
            },
          );
          return terminals.length > 0
            ? { ...workspace, count: terminals.length, terminals }
            : workspace;
        }
        const terminals = leafIds(tab.paneTree).map(
          (leafId, index): WorkspaceTerminalItem => {
            const trackedCommand = agentCommands.get(leafId);
            const savedCommand = findLeafLastCommand(tab.paneTree, leafId);
            const command = trackedCommand ?? savedCommand;
            const agent = detectTrackedCliAgent(trackedCommand, savedCommand);
            return {
              leafId,
              cwd: findLeafCwd(tab.paneTree, leafId) ?? tab.cwd ?? workspace.workingFolder ?? null,
              label: command ?? (agent ?? `Terminal ${index + 1}`),
              onClose: () => closePaneByLeaf(leafId),
              ...(agent ? { agent } : {}),
              active:
                workspace.id === activeWorkspaceId && leafId === tab.activeLeafId,
              responding: respondingLeaves.has(leafId),
              completed: completedLeaves.has(leafId),
              state: (blockedLeaves.has(leafId)
                ? "blocked"
                : requestedLeaves.has(leafId) || respondingLeaves.has(leafId)
                  ? "working"
                    : completedLeaves.has(leafId)
                      ? "done"
                      : undefined) as AgentDisplayState | undefined,
            };
          },
        );
        return {
          ...workspace,
          count: terminals.length,
          terminals,
          responding: terminals.some((terminal) => terminal.responding),
          state: (terminals.find((terminal) => terminal.state === "blocked")
            ? "blocked"
            : terminals.find((terminal) => terminal.state === "working")
              ? "working"
                : terminals.find((terminal) => terminal.state === "done")
                  ? "done"
                  : undefined) as AgentDisplayState | undefined,
        };
      }),
    [
      activeWorkspaceId,
      activeWorkspaceTerminals,
      canvasTerminalSelectionVersion,
      agentCommands,
      blockedLeaves,
      closePaneByLeaf,
      completedLeaves,
      persistedWorkspacePanes,
      respondingLeaves,
      requestedLeaves,
      tabs,
      workspaces,
    ],
  );
  const isTerminalTab = activeTab?.kind === "terminal";
  const isEditorTab = activeTab?.kind === "editor";
  const isPreviewTab = activeTab?.kind === "preview";
  const isMarkdownTab = activeTab?.kind === "markdown";
  const isAiDiffTab = activeTab?.kind === "ai-diff";
  const isGitDiffTab =
    activeTab?.kind === "git-diff" || activeTab?.kind === "git-commit-file";
  const isGitHistoryTab = activeTab?.kind === "git-history";
  const isArchitectureTab = activeTab?.kind === "architecture";
  const handleAgentNativeSessionId = useCallback(
    (workspaceId: string, tabId: number, chatId: string, provider: CliAgent, nativeSessionId: string) => {
      const workspace = workspacesRef.current.find((item) => item.id === workspaceId);
      if (!workspace) return;
      updateTab(tabId, { nativeSessionId });
      const tabIndex = workspace.agentChatIds?.indexOf(chatId) ?? workspace.agentTabIds?.indexOf(tabId) ?? -1;
      const agentProviders = [...(workspace.agentProviders ?? [])];
      if (tabIndex >= 0) agentProviders[tabIndex] = provider;
      const updated: WorkspaceRecord = {
        ...workspace,
          agentSessionId: nativeSessionId,
        agentProviders,
        agentSessionIds: (() => {
          const next = [...(workspace.agentSessionIds ?? [])];
          const index = tabIndex;
          if (index >= 0) next[index] = nativeSessionId;
          else if (next.length === 0) next[0] = nativeSessionId;
          return next;
        })(),
        updatedAt: Date.now(),
      };
      setWorkspaces((current) =>
        current.map((workspace) =>
          workspace.id === updated.id ? updated : workspace,
        ),
      );
      void invoke("db_save_workspace", { workspace: updated }).catch((error) => {
        console.error("Failed to persist agent session identity:", error);
      });
    },
    [updateTab],
  );

  // When an AI diff is approved (write_file applied to disk), reload any
  // open editor tabs for that path so the user sees the new content. We
  // track which approvalIds we've already handled to fire the reload only
  // once per applied diff.
  const appliedDiffsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const t of tabs) {
      if (t.kind !== "ai-diff") continue;
      if (t.status !== "approved") continue;
      if (appliedDiffsRef.current.has(t.approvalId)) continue;
      appliedDiffsRef.current.add(t.approvalId);
      for (const e of tabs) {
        if (e.kind !== "editor") continue;
        if (e.path !== t.path) continue;
        editorRefs.current.get(e.id)?.reload();
      }
    }
  }, [tabs]);

  useEffect(() => {
    type FileWrittenPayload = { path: string; source?: string };
    const unlistenPromise =
      getCurrentWebviewWindow().listen<FileWrittenPayload>(
        "fs:file-written",
        (event) => {
          if (event.payload.source === "editor") return;
          const normalizedPath = event.payload.path.replace(/\\/g, "/");
          const currentTabs = tabsRef.current;
          for (const t of currentTabs) {
            if (t.kind !== "editor") continue;
            if (t.path.replace(/\\/g, "/") === normalizedPath) {
              editorRefs.current.get(t.id)?.reload();
            }
          }
        },
      );
    return () => {
      void unlistenPromise.then((un) => un());
    };
  }, []);

  const { explorerRoot, inheritedCwdForNewTab } = useWorkspaceCwd(
    activeTab,
    tabs,
    launchCwd ?? home,
  );
  const workspaceSetupFolder = explorerRoot ?? launchCwd ?? home;

  useEffect(() => {
    setActiveSearchAddon(
      activeLeafId !== null
        ? (searchAddons.current.get(activeLeafId) ?? null)
        : null,
    );
    setActiveEditorHandle(editorRefs.current.get(activeId) ?? null);
  }, [activeId, activeLeafId]);

  const handleSearchReady = useCallback(
    (leafId: number, addon: SearchAddon) => {
      searchAddons.current.set(leafId, addon);
      if (leafId === activeLeafId) setActiveSearchAddon(addon);
    },
    [activeLeafId],
  );

  const clearWorkspaceTabOwnership = useCallback((tabId: number) => {
    setWorkspaces((current) =>
      current.map((workspace) => {
        if (workspace.agentTabIds?.includes(tabId)) {
          const agentTabIds = workspace.agentTabIds.filter((id) => id !== tabId);
          return {
            ...workspace,
            agentTabIds,
            tabId: workspace.tabId === tabId ? agentTabIds[0] ?? null : workspace.tabId,
          };
        }
        if (workspace.tabId === tabId) {
          return { ...workspace, tabId: null };
        }
        if (workspace.canvasTabId === tabId) {
          return { ...workspace, canvasTabId: null };
        }
        return workspace;
      }),
    );
  }, []);

  const disposeTab = useCallback(
    (id: number) => {
      // Terminal-leaf-keyed maps (terminalRefs/searchAddons) are pruned by
      // the effect below as the pane tree changes; only the tab-id-keyed
      // handles need explicit cleanup here.
      editorRefs.current.delete(id);
      previewRefs.current.delete(id);
      clearWorkspaceTabOwnership(id);
      closeTab(id);
    },
    [clearWorkspaceTabOwnership, closeTab],
  );

  // Drives session disposal off the pane tree, not React lifecycles —
  // split/unsplit re-mount components but the leaf is still live.
  const liveLeavesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const live = new Set<number>();
    for (const t of tabs) {
      if (t.kind === "terminal") {
        for (const id of leafIds(t.paneTree)) live.add(id);
      }
    }
    for (const id of liveLeavesRef.current) {
      if (!live.has(id)) disposeSession(id);
    }
    liveLeavesRef.current = live;
    for (const k of [...terminalRefs.current.keys()])
      if (!live.has(k)) terminalRefs.current.delete(k);
    for (const k of [...searchAddons.current.keys()])
      if (!live.has(k)) searchAddons.current.delete(k);
  }, [tabs]);

  const handleClose = useCallback(
    (id: number) => {
      const t = tabs.find((x) => x.id === id);
      if (t?.kind === "editor" && t.dirty) {
        setPendingCloseTab(id);
        return;
      }
      disposeTab(id);
    },
    [tabs, disposeTab],
  );

  const confirmClose = useCallback(() => {
    if (pendingCloseTab !== null) {
      disposeTab(pendingCloseTab);
      setPendingCloseTab(null);
    }
  }, [pendingCloseTab, disposeTab]);

  const cancelClose = useCallback(() => {
    setPendingCloseTab(null);
  }, []);

  const cycleTab = useCallback(
    (delta: 1 | -1) => {
      if (tabs.length < 2) return;
      const idx = tabs.findIndex((t) => t.id === activeId);
      const nextIdx = (idx + delta + tabs.length) % tabs.length;
      setActiveId(tabs[nextIdx].id);
    },
    [tabs, activeId, setActiveId],
  );

  const openBottomTerminal = useCallback(() => {
    const activeTerminal = tabs.find((tab) => tab.id === activeId);
    const cwd =
      activeWorkspaceFolder ??
      (activeTerminal?.kind === "terminal"
        ? findLeafCwd(activeTerminal.paneTree, activeTerminal.activeLeafId) ??
          activeTerminal.cwd
        : null) ??
      explorerRoot ??
      launchCwd ??
      home ??
      null;
    setBottomTerminalCwd(cwd);
    setBottomTerminalOpen(true);
  }, [
    activeId,
    activeWorkspaceFolder,
    explorerRoot,
    home,
    launchCwd,
    tabs,
  ]);

  const toggleBottomTerminal = useCallback(() => {
    if (bottomTerminalOpen) {
      setBottomTerminalOpen(false);
      return;
    }
    openBottomTerminal();
  }, [bottomTerminalOpen, openBottomTerminal]);

  useEffect(() => {
    if (!bottomTerminalOpen) return;
    const frame = requestAnimationFrame(() => bottomTerminalRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [bottomTerminalOpen]);

  const openNewTab = useCallback(() => {
    newTab(inheritedCwdForNewTab());
  }, [newTab, inheritedCwdForNewTab]);

  useEffect(() => {
    const unlisten = listen("cmdspace:new-tab", openNewTab);

    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [openNewTab]);

  useEffect(() => {
    const unlisten = listen("cmdspace:open-shortcuts", () => {
      setShortcutsOpen(true);
    });

    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  const openTopMusicTab = useCallback(async () => {
    try {
      await invoke("install_music_cli_script");
    } catch (error) {
      console.error("Failed to install Music CLI script:", error);
    }
    newTab(inheritedCwdForNewTab(), 'source "$HOME/.cmdspace/music-cli.zsh"', "Music CLI");
  }, [newTab, inheritedCwdForNewTab]);

  const openNewPrivateTab = useCallback(() => {
    newPrivateTab(inheritedCwdForNewTab());
  }, [newPrivateTab, inheritedCwdForNewTab]);

  const handleOpenWorkspaceWithoutAi = useCallback(
    async (
      terminalCount: number,
      workingFolder: string | null,
      initialCommands: string[] = [],
      requestedName?: string,
      requestedColor?: string,
      workspaceMode: WorkspaceMode = "standard",
      workspaceAgent: CliAgent | null = null,
      workspaceAgents: CliAgent[] = [],
      initialAgentDraft = "",
      initialHistoryAttachments: AgentChatHistoryAttachment[] = [],
    ): Promise<WorkspaceRecord | null> => {
      const fallbackName = nextWorkspaceName(workspaces);
      if (fallbackName === null) {
        window.alert("Workspace limit reached (99).");
        return null;
      }
      const name = requestedName?.trim() || fallbackName;

      const effectiveWorkingFolder =
        workingFolder ?? inheritedCwdForNewTab() ?? null;
      const paneLaunchPlan =
        initialCommands.length > 0 || workspaceMode === "canvas"
          ? Array.from({ length: terminalCount }, (_, paneIndex) => ({
              paneIndex,
              workingFolder: effectiveWorkingFolder,
              lastCommand: initialCommands[paneIndex] ?? null,
              autoLaunch: Boolean(initialCommands[paneIndex]),
            }))
          : undefined;
      const canvasDiagram =
        workspaceMode === "canvas"
          ? canvasWorkspaceDiagram(
              terminalCount,
              effectiveWorkingFolder,
              initialCommands,
            )
          : null;
      const now = Date.now();
      const wsId = `workspace-tab-${now}-${Math.random().toString(36).slice(2, 9)}`;
      const agentProviders =
        workspaceMode === "agent"
          ? (workspaceAgents.length > 0
              ? workspaceAgents
              : workspaceAgent
                ? [workspaceAgent]
                : []
            ).slice(0, 12)
          : [];
      const agentChatIds = workspaceMode === "agent"
        ? agentProviders.map((_, index) => `${wsId}:chat:${index + 1}`)
        : [];
      const agentTabIds =
        workspaceMode === "agent"
          ? (workspaceAgents.length > 0
              ? workspaceAgents
              : workspaceAgent
                ? [workspaceAgent]
                : []
            )
              .slice(0, 12)
              .map((provider, index) =>
                newAgentChatTab({
                  title: `${name} · ${index + 1}`,
                  provider,
                  cwd: effectiveWorkingFolder ?? "",
                  nativeSessionId: null,
                  chatId: agentChatIds[index],
                  initialDraft: index === 0 ? initialAgentDraft : undefined,
                  initialHistoryAttachments: index === 0 ? initialHistoryAttachments : undefined,
                }),
              )
          : [];
      const tabId = workspaceMode === "canvas"
        ? null
        : workspaceMode === "agent"
          ? agentTabIds[0] ?? null
          : newWorkspaceTab(
              effectiveWorkingFolder ?? undefined,
              terminalCount,
              paneLaunchPlan,
              null,
              name,
            );
      const canvasTabId =
        canvasDiagram
          ? newArchitectureTab(canvasDiagram, name)
          : null;

      const newWs: WorkspaceRecord = {
        id: wsId,
        name,
        count: workspaceMode === "agent" ? agentTabIds.length : terminalCount,
        accentColor: normalizeWorkspaceAccentColor(
          requestedColor,
          workspaceAccentForIndex(workspaces.length),
        ),
        workingFolder: effectiveWorkingFolder,
        createdAt: now,
        updatedAt: now,
        displayOrder: workspaces.length,
        paneLayout: canvasDiagram
          ? serializeCanvasWorkspaceDiagram(canvasDiagram)
          : null,
        tabId: workspaceMode === "canvas" ? null : tabId,
        canvasTabId,
        workspaceMode,
        agentProvider: workspaceMode === "agent" ? workspaceAgent : null,
        agentSessionId: null,
        agentTabIds,
        agentProviders,
        agentSessionIds: workspaceMode === "agent"
          ? agentProviders.map(() => null)
          : [],
        agentChatIds,
      };
      saveRecentWorkspace(newWs);

      const savePaneLaunchPlan = () => {
        if (!paneLaunchPlan) return;
        for (const pane of paneLaunchPlan) {
          void persistPaneRecord(
            paneRecordFromCommand(
              wsId,
              pane.paneIndex,
              pane.workingFolder,
              pane.lastCommand,
              pane.autoLaunch,
            ),
          ).catch((err) => {
            console.error(
              "Failed to save workspace agent pane to SQLite:",
              err,
            );
          });
        }
      };

      try {
        await invoke("db_save_workspace", { workspace: newWs });
        savePaneLaunchPlan();
      } catch (err) {
        console.error("Failed to save workspace to SQLite:", err);
      }
      setWorkspaces((current) => [...current, newWs]);
      setWorkspaceSetupOpen(false);
      const activatedTabId = tabId ?? canvasTabId;
      if (activatedTabId !== null) setActiveId(activatedTabId);
      const bootstrapTab = tabsRef.current.find(
        (tab) => tab.id === 1 && tab.title === "shell",
      );
      if (bootstrapTab && tabsRef.current.length > 1) {
        closeTab(bootstrapTab.id);
      }
      return newWs;
    },
    [
      inheritedCwdForNewTab,
      closeTab,
      newArchitectureTab,
      newAgentChatTab,
      newWorkspaceTab,
      persistPaneRecord,
      saveRecentWorkspace,
      workspaces,
    ],
  );

  const handleWorkspaceSetupCancel = useCallback(() => {
    if (workspacesHydrated && workspaces.length === 0) return;
    setWorkspaceSetupOpen(false);
    setWorkspaceForkContext(null);
  }, [workspaces, workspacesHydrated]);

  const handleForkAgentResponse = useCallback(
    (input: {
      workspaceId: string;
      provider: CliAgent;
      cwd: string;
      destination: "tab" | "workspace";
      attachment: AgentChatHistoryAttachment;
    }) => {
      const workspace = workspacesRef.current.find((item) => item.id === input.workspaceId);
      if (!workspace) return;

      if (input.destination === "tab") {
        const nextIndex = (workspace.agentChatIds?.length ?? 0) + 1;
        const chatId = `${workspace.id}:fork:${Date.now()}`;
        const tabId = newAgentChatTab({
          title: `${workspace.name} · ${nextIndex}`,
          provider: input.provider,
          cwd: input.cwd,
          chatId,
          nativeSessionId: null,
          initialHistoryAttachments: [input.attachment],
        });
        const updated: WorkspaceRecord = {
          ...workspace,
          tabId: workspace.tabId ?? tabId,
          agentTabIds: [...(workspace.agentTabIds ?? []), tabId],
          agentProviders: [...(workspace.agentProviders ?? []), input.provider],
          agentSessionIds: [...(workspace.agentSessionIds ?? []), null],
          agentChatIds: [...(workspace.agentChatIds ?? []), chatId],
          count: (workspace.agentTabIds?.length ?? 0) + 1,
          updatedAt: Date.now(),
        };
        setWorkspaces((current) => current.map((item) => item.id === workspace.id ? updated : item));
        saveRecentWorkspace(updated);
        void invoke("db_save_workspace", { workspace: updated }).catch((error) => {
          console.error("Failed to persist forked agent chat:", error);
        });
        return;
      }

      setWorkspaceForkContext({
        provider: input.provider,
        cwd: input.cwd,
        attachment: input.attachment,
      });
      setWorkspaceSetupOpen(true);
    },
    [newAgentChatTab, saveRecentWorkspace],
  );

  const selectWorkspace = useWorkspaceSelection({
    workspaces,
    tabs,
    closeWorkspaceSetup: () => setWorkspaceSetupOpen(false),
    saveRecentWorkspace,
    activateTab: setActiveId,
    updateCanvasTabDiagram: (tabId, diagram) => {
      updateTab(tabId, { diagram });
    },
    persistCanvasDiagram: (tabId, diagram) => {
      persistCanvasDiagramRef.current?.(tabId, diagram);
    },
    createCanvasTab: newArchitectureTab,
    createAgentChatTab: newAgentChatTab,
    createWorkspaceTab: newWorkspaceTab,
    replaceWorkspace: (workspaceId, patch) => {
      const current = workspacesRef.current;
      workspacesRef.current = current.map((workspace) =>
        workspace.id === workspaceId ? { ...workspace, ...patch } : workspace,
      );
      setWorkspaces((current) =>
        current.map((workspace) =>
          workspace.id === workspaceId ? { ...workspace, ...patch } : workspace,
        ),
      );
    },
    listWorkspacePanes: (workspaceId) =>
      invoke<WorkspaceSelectionPane[]>("db_list_panes", { workspaceId }),
    resolvePaneResumeCommands: async (workspaceId, panes, workspaceCwd) => {
      if (!workspaceCwd) return panes;
      const resolved = await syncWorkspacePaneNativeSessions(
        workspaceId,
        workspaceCwd,
      );
      return resolved.length > 0 ? resolved : panes;
    },
    buildCanvasWorkspaceDiagram: canvasWorkspaceDiagram,
    onLoadCanvasWorkspacePanesError: (err) => {
      console.error("Failed to load canvas workspace panes from SQLite:", err);
    },
    onLoadWorkspacePanesError: (err) => {
      console.error("Failed to load workspace panes from SQLite:", err);
    },
  });

  const handleSelectWorkspace = useCallback(
    (workspaceId: string) => {
      const requestId = ++workspaceSelectionRequestRef.current;
      window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
      const workspace = workspacesRef.current.find((item) => item.id === workspaceId);
      const existingTabId = workspace?.tabId ?? workspace?.canvasTabId;
      if (existingTabId !== null && existingTabId !== undefined) {
        setActiveId(existingTabId);
        return;
      }
      if (workspaceOpenGateRef.current.isOpening(workspaceId)) return;
      setOpeningWorkspaceId(workspaceId);
      void workspaceOpenGateRef.current
        .open(workspaceId, () =>
          selectWorkspace(
            workspaceId,
            () => requestId === workspaceSelectionRequestRef.current,
          ),
        )
        .finally(() => setOpeningWorkspaceId((current) => current === workspaceId ? null : current));
    },
    [selectWorkspace, setActiveId],
  );

  const handleSelectWorkspaceRef = useRef(handleSelectWorkspace);
  handleSelectWorkspaceRef.current = handleSelectWorkspace;

  useEffect(() => {
    if (
      !workspacesHydrated ||
      workspaces.length === 0 ||
      activeWorkspaceId !== null ||
      pendingBootstrapCloseRef.current
    ) {
      return;
    }
    initialWorkspaceActivationHandledRef.current = true;
    const storedWorkspaceId = window.localStorage.getItem(
      ACTIVE_WORKSPACE_STORAGE_KEY,
    );
    const firstWorkspace =
      workspaces.find((workspace) => workspace.id === storedWorkspaceId) ??
      workspaces[0];
    if (!firstWorkspace) return;
    pendingBootstrapCloseRef.current = true;
    handleSelectWorkspace(firstWorkspace.id);
  }, [activeWorkspaceId, handleSelectWorkspace, workspaces, workspacesHydrated]);

  useEffect(() => {
    if (!pendingBootstrapCloseRef.current || activeWorkspaceId === null) {
      return;
    }
    const bootstrapTab = tabs.find(
      (tab) => tab.id === 1 && tab.title === "shell",
    );
    if (bootstrapTab && tabs.length > 1) {
      closeTab(bootstrapTab.id);
    }
    pendingBootstrapCloseRef.current = false;
  }, [activeWorkspaceId, closeTab, tabs]);

  useEffect(() => {
    const unlisten = listen<string>("cmdspace:open-workspace", (event) => {
      handleSelectWorkspaceRef.current(event.payload);
    });

    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  const deleteWorkspace = useCallback(
    (workspaceId: string) => {
      if (workspacesRef.current.length <= 1) return;
      const workspace = workspacesRef.current.find(
        (item) => item.id === workspaceId,
      );
      if (!workspace) return;

      const workspaceTabIds = new Set(
        [
          workspace.tabId,
          workspace.canvasTabId,
          ...(workspace.agentTabIds ?? []),
        ].filter(
          (tabId): tabId is number => tabId !== null,
        ),
      );
      const wouldLeaveNoTabs =
        workspaceTabIds.size > 0 &&
        tabsRef.current.every((tab) => workspaceTabIds.has(tab.id));

      if (wouldLeaveNoTabs) {
        // closeTab preserves the final tab. Replace it here so the deleted
        // workspace cannot leave a terminal tab without a workspace owner.
        resetWorkspace(launchCwd ?? home ?? undefined);
      } else {
        for (const tabId of workspaceTabIds) {
          disposeTab(tabId);
        }
      }

      setWorkspaces((current) =>
        current.filter((item) => item.id !== workspaceId),
      );

      invoke("db_delete_workspace", { id: workspaceId }).catch((err) => {
        console.error("Failed to delete workspace from SQLite:", err);
      });
    },
    [disposeTab, home, launchCwd, resetWorkspace],
  );

  const handleCloseWorkspace = useCallback(
    (workspaceId: string) => {
      if (workspacesRef.current.length <= 1) return;
      const workspace = workspacesRef.current.find(
        (item) => item.id === workspaceId,
      );
      if (!workspace) return;

      if (skipWorkspaceDeleteConfirm) {
        deleteWorkspace(workspaceId);
        return;
      }

      setWorkspaceDeleteDoNotAskAgain(false);
      setPendingDeleteWorkspaceId(workspaceId);
    },
    [deleteWorkspace, skipWorkspaceDeleteConfirm],
  );

  const confirmDeleteWorkspace = useCallback(() => {
    if (pendingDeleteWorkspaceId === null) return;
    if (workspacesRef.current.length <= 1) {
      setPendingDeleteWorkspaceId(null);
      return;
    }

    if (workspaceDeleteDoNotAskAgain) {
      setSkipWorkspaceDeleteConfirm(true);
      try {
        window.localStorage.setItem(WORKSPACE_DELETE_CONFIRM_STORAGE_KEY, "1");
      } catch {
        // storage may fail in private mode
      }
    }

    deleteWorkspace(pendingDeleteWorkspaceId);
    setPendingDeleteWorkspaceId(null);
  }, [deleteWorkspace, pendingDeleteWorkspaceId, workspaceDeleteDoNotAskAgain]);

  const cancelDeleteWorkspace = useCallback(() => {
    setPendingDeleteWorkspaceId(null);
    setWorkspaceDeleteDoNotAskAgain(false);
  }, []);

  const handleRenameWorkspace = useCallback(
    (workspaceId: string, name: string) => {
      let nextName = name.trim();
      if (nextName.length === 0) return;

      const otherWorkspaces = workspaces.filter((w) => w.id !== workspaceId);
      const existingNames = new Set(
        otherWorkspaces.map((w) => w.name.toLowerCase()),
      );

      if (existingNames.has(nextName.toLowerCase())) {
        let suffix = 1;
        let uniqueName = `${nextName} (${suffix})`;
        while (existingNames.has(uniqueName.toLowerCase())) {
          suffix += 1;
          uniqueName = `${nextName} (${suffix})`;
        }
        nextName = uniqueName;
      }

      setWorkspaces((current) =>
        current.map((workspace) => {
          if (workspace.id === workspaceId) {
            if (workspace.tabId !== null) {
              updateTab(workspace.tabId, { title: nextName });
            }
            if (workspace.canvasTabId !== null) {
              updateTab(workspace.canvasTabId, {
                title: nextName,
              });
            }
            const updated = {
              ...workspace,
              name: nextName,
              updatedAt: Date.now(),
            };
            invoke("db_save_workspace", { workspace: updated }).catch((err) =>
              console.error("Failed to save renamed workspace to SQLite:", err),
            );
            return updated;
          }
          return workspace;
        }),
      );
    },
    [updateTab, workspaces],
  );

  const handleChangeWorkspaceColor = useCallback(
    (workspaceId: string, accentColor: string) => {
      const nextAccentColor = normalizeWorkspaceAccentColor(accentColor);
      setWorkspaces((current) =>
        current.map((workspace) => {
          if (workspace.id !== workspaceId) return workspace;
          if (workspace.accentColor === nextAccentColor) return workspace;

          const updated = {
            ...workspace,
            accentColor: nextAccentColor,
            updatedAt: Date.now(),
          };
          invoke("db_save_workspace", { workspace: updated }).catch((err) =>
            console.error("Failed to save workspace color to SQLite:", err),
          );
          return updated;
        }),
      );
    },
    [],
  );

  const handleReorderWorkspaces = useCallback(
    (draggedId: string, targetId: string, position: "before" | "after") => {
      setWorkspaces((current) => {
        const fromIndex = current.findIndex((item) => item.id === draggedId);
        const toIndex = current.findIndex((item) => item.id === targetId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex)
          return current;

        const next = [...current];
        const [dragged] = next.splice(fromIndex, 1);

        let insertAt = next.findIndex((item) => item.id === targetId);
        if (position === "after") insertAt += 1;

        next.splice(insertAt, 0, dragged);

        const reordered = next.map((item, idx) => ({
          ...item,
          displayOrder: idx,
        }));

        const orders = reordered.map((item) => [item.id, item.displayOrder]);
        invoke("db_reorder_workspaces", { orders }).catch((err) =>
          console.error("Failed to save reordered workspaces to SQLite:", err),
        );

        return reordered;
      });
    },
    [],
  );

  const cycleWorkspace = useCallback(
    (delta: 1 | -1) => {
      if (workspaces.length < 2) return;
      const currentIdx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
      if (currentIdx === -1) {
        if (delta === 1) {
          handleSelectWorkspace(workspaces[0].id);
        } else {
          handleSelectWorkspace(workspaces[workspaces.length - 1].id);
        }
        return;
      }
      const nextIdx =
        (currentIdx + delta + workspaces.length) % workspaces.length;
      handleSelectWorkspace(workspaces[nextIdx].id);
    },
    [workspaces, activeWorkspaceId, handleSelectWorkspace],
  );

  const focusDirectionalPane = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      if (activeLeafId === null || !activeTab) return;
      const activeLeaf = document.querySelector(
        `[data-pane-leaf="${activeLeafId}"]`,
      );
      if (!activeLeaf) return;
      const activeRect = activeLeaf.getBoundingClientRect();
      const activeCenter = {
        x: activeRect.left + activeRect.width / 2,
        y: activeRect.top + activeRect.height / 2,
      };

      const candidates: { id: number; distance: number }[] = [];
      const leafElements = document.querySelectorAll("[data-pane-leaf]");
      leafElements.forEach((el) => {
        const id = parseInt(el.getAttribute("data-pane-leaf") || "", 10);
        if (isNaN(id) || id === activeLeafId) return;
        if (activeTab.kind === "terminal" && !hasLeaf(activeTab.paneTree, id))
          return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        let isValid = false;
        let primaryDist = 0;
        let secondaryDist = Math.abs(cy - activeCenter.y);

        if (direction === "left") {
          isValid = cx < activeCenter.x - 2;
          primaryDist = activeCenter.x - cx;
          secondaryDist = Math.abs(cy - activeCenter.y);
        } else if (direction === "right") {
          isValid = cx > activeCenter.x + 2;
          primaryDist = cx - activeCenter.x;
          secondaryDist = Math.abs(cy - activeCenter.y);
        } else if (direction === "up") {
          isValid = cy < activeCenter.y - 2;
          primaryDist = activeCenter.y - cy;
          secondaryDist = Math.abs(cx - activeCenter.x);
        } else if (direction === "down") {
          isValid = cy > activeCenter.y + 2;
          primaryDist = cy - activeCenter.y;
          secondaryDist = Math.abs(cx - activeCenter.x);
        }

        if (isValid) {
          const score = primaryDist + 3 * secondaryDist;
          candidates.push({ id, distance: score });
        }
      });

      if (candidates.length === 0) return;
      candidates.sort((a, b) => a.distance - b.distance);
      focusPane(activeTab.id, candidates[0].id);
    },
    [activeLeafId, activeTab, focusPane],
  );

  const cdInNewTab = useCallback(
    (path: string) => {
      const tabId = newTab(path);
      setTimeout(() => {
        const tab = tabsRef.current.find((x) => x.id === tabId);
        if (!tab || tab.kind !== "terminal") return;
        const t = terminalRefs.current.get(tab.activeLeafId);
        if (!t) return;
        const quoted = path.includes(" ")
          ? `'${path.replace(/'/g, `'\\''`)}'`
          : path;
        t.write(`cd ${quoted}\r`);
        t.focus();
      }, 80);
    },
    [newTab],
  );

  const handleOpenFile = useCallback(
    (path: string, pin?: boolean) => {
      // Explorer defaults to preview (pin=false); explicit actions like
      // context-menu "Open" pass pin=true for a persistent tab.
      openFileTab(path, pin ?? false);
    },
    [openFileTab],
  );

  const handlePathRenamed = useCallback(
    (from: string, to: string) => {
      for (const t of tabs) {
        if (t.kind !== "editor") continue;
        if (t.path === from) {
          const i = to.lastIndexOf("/");
          updateTab(t.id, { path: to, title: i === -1 ? to : to.slice(i + 1) });
        } else if (t.path.startsWith(`${from}/`)) {
          const suffix = t.path.slice(from.length);
          const newPath = `${to}${suffix}`;
          const i = newPath.lastIndexOf("/");
          updateTab(t.id, {
            path: newPath,
            title: i === -1 ? newPath : newPath.slice(i + 1),
          });
        }
      }
    },
    [tabs, updateTab],
  );

  const confirmDeleteClose = useCallback(() => {
    if (pendingDeleteTabs !== null) {
      for (const id of pendingDeleteTabs) disposeTab(id);
      setPendingDeleteTabs(null);
    }
  }, [pendingDeleteTabs, disposeTab]);

  const cancelDeleteClose = useCallback(() => {
    setPendingDeleteTabs(null);
  }, []);

  const handlePathDeleted = useCallback(
    (path: string) => {
      const dirty: number[] = [];
      for (const t of tabs) {
        if (t.kind !== "editor") continue;
        if (t.path !== path && !t.path.startsWith(`${path}/`)) continue;
        if (t.dirty) {
          dirty.push(t.id);
        } else {
          disposeTab(t.id);
        }
      }
      if (dirty.length > 0) setPendingDeleteTabs(dirty);
    },
    [tabs, disposeTab],
  );

  const activeTerminalLeafCwd =
    activeTab?.kind === "terminal"
      ? (findLeafCwd(activeTab.paneTree, activeTab.activeLeafId) ??
        activeTab.cwd ??
        null)
      : null;

  const activeFilePath = (() => {
    if (activeTab?.kind === "editor") return activeTab.path;
    if (activeTab?.kind === "git-diff") {
      if (/^([A-Za-z]:|\/|\\)/.test(activeTab.path)) return activeTab.path;
      const root = activeTab.repoRoot.replace(/[\\/]+$/, "");
      const rel = activeTab.path.replace(/^[\\/]+/, "");
      return `${root}/${rel}`;
    }
    if (activeTab?.kind === "git-commit-file") {
      const root = activeTab.repoRoot.replace(/[\\/]+$/, "");
      const rel = activeTab.path.replace(/^[\\/]+/, "");
      return `${root}/${rel}`;
    }
    return null;
  })();
  const workspaceFallbackPath = launchCwdResolved
    ? (launchCwd ?? home ?? null)
    : null;
  const sourceControlContextPath = (() => {
    if (activeTab?.kind === "terminal") {
      return activeTerminalLeafCwd ?? explorerRoot ?? workspaceFallbackPath;
    }
    if (activeTab?.kind === "editor") return dirname(activeTab.path);
    if (activeTab?.kind === "git-diff") return activeTab.repoRoot;
    if (activeTab?.kind === "git-commit-file") return activeTab.repoRoot;
    if (activeTab?.kind === "git-history") return activeTab.repoRoot;
    return explorerRoot ?? workspaceFallbackPath;
  })();
  const hasOpenGitTab = useMemo(
    () =>
      tabs.some(
        (t) =>
          t.kind === "git-diff" ||
          t.kind === "git-history" ||
          t.kind === "git-commit-file",
      ),
    [tabs],
  );
  const sourceControlActive =
    hasOpenGitTab ||
    (sidebarView === "editor" && editorSidebarView === "source-control");
  // Stable per-session path so switching tabs / cd-ing in a shell does NOT
  // re-fire git IPC for the header git controls unless a git tab is open.
  const badgeContextPath = workspaceFallbackPath;
  const sourceControlPath = sourceControlActive
    ? sourceControlContextPath
    : badgeContextPath;
  const sourceControl = useSourceControl(sourceControlPath, true);

  const toggleSourceControl = useCallback(() => {
    setEditorSidebarView("source-control");
    cycleSidebarView("editor");
  }, [cycleSidebarView]);

  const openGitGraphFromContext = useCallback(async () => {
    const known = sourceControl.hasRepo ? sourceControl.repo : null;
    if (known) {
      openCommitHistoryTab({
        repoRoot: known.repoRoot,
        branch: sourceControl.status?.branch ?? null,
      });
      return;
    }
    if (!sourceControlContextPath) return;
    try {
      const repo = await native.gitResolveRepo(sourceControlContextPath);
      if (!repo) return;
      openCommitHistoryTab({ repoRoot: repo.repoRoot, branch: repo.branch });
    } catch {
      /* noop */
    }
  }, [
    openCommitHistoryTab,
    sourceControl.hasRepo,
    sourceControl.repo,
    sourceControl.status?.branch,
    sourceControlContextPath,
  ]);

  const openPreviewTab = useCallback(
    (url: string) => {
      const id = newPreviewTab(url);
      // Focus the address bar if the URL is empty so the user can type.
      if (!url) {
        setTimeout(() => previewRefs.current.get(id)?.focusAddressBar(), 0);
      }
      return id;
    },
    [newPreviewTab],
  );

  const openMarkdownPreview = useCallback(
    (path: string) => {
      newMarkdownTab(path);
    },
    [newMarkdownTab],
  );

  const persistSplitPaneTree = useCallback(
    (tabId: number, paneTree: PaneNode) => {
      const workspace = workspacesRef.current.find((item) => item.tabId === tabId);
      if (!workspace) return;
      const updated = {
        ...workspace,
        count: leafIds(paneTree).length,
        paneLayout: JSON.stringify(paneTree),
        updatedAt: Date.now(),
      };
      setWorkspaces((current) => current.map((item) => item.id === workspace.id ? updated : item));
      void invoke("db_save_workspace", { workspace: updated });
      void Promise.all(
        leafIds(paneTree).map((leafId, paneIndex) =>
          persistPaneRecord(
            paneRecordFromCommand(
              workspace.id,
              paneIndex,
              findLeafCwd(paneTree, leafId) ?? workspace.workingFolder,
              findLeafLastCommand(paneTree, leafId) ?? null,
              findLeafAutoLaunch(paneTree, leafId),
              persistedPaneFor(workspace.id, paneIndex),
            ),
          ),
        ),
      );
    },
    [persistPaneRecord, persistedPaneFor],
  );

  const splitActivePaneInActiveTab = useCallback(
    (dir: "row" | "col") => {
      const t = tabsRef.current.find((x) => x.id === activeId);
      if (!t || t.kind !== "terminal") return;
      const appended = splitActivePane(activeId, dir);
      if (appended) persistSplitPaneTree(activeId, appended.paneTree);
    },
    [activeId, persistSplitPaneTree, splitActivePane],
  );

  const handleCloseTabOrPane = useCallback(() => {
    const t = tabsRef.current.find((x) => x.id === activeId);
    if (t?.kind === "terminal" && leafIds(t.paneTree).length > 1) {
      closeActivePane(activeId);
      return;
    }
    handleClose(activeId);
  }, [activeId, closeActivePane, handleClose]);

  const onCanvasTerminalHandleChange = useCallback(
    (
      tabId: number,
      terminalId: string,
      handle: CanvasTerminalHandle | null,
    ) => {
      const key = canvasTerminalRefKey(tabId, terminalId);
      if (handle) {
        canvasTerminalRefs.current.set(key, handle);
      } else {
        canvasTerminalRefs.current.delete(key);
      }
    },
    [],
  );

  const onActiveCanvasTerminalChange = useCallback(
    (tabId: number, terminalId: string | null) => {
      if (terminalId) {
        activeCanvasTerminalIds.current.set(tabId, terminalId);
      } else {
        activeCanvasTerminalIds.current.delete(tabId);
      }
      setCanvasTerminalSelectionVersion((version) => version + 1);
    },
    [],
  );

  const captureVoiceTarget = useCallback((): SpeechInputTarget | null => {
    const tab = tabsRef.current.find((item) => item.id === activeId);
    if (!tab) return null;
    if (tab.kind === "architecture") {
      const terminalId = activeCanvasTerminalIds.current.get(tab.id);
      if (!terminalId) return null;
      const terminal = canvasTerminalRefs.current.get(
        canvasTerminalRefKey(tab.id, terminalId),
      );
      const node = tab.diagram?.nodes.find(
        (item) => item.id === terminalId && item.kind === "terminal",
      );
      if (!terminal || !node) return null;
      return {
        kind: "canvas-terminal",
        tabId: tab.id,
        terminalId,
      };
    }
    if (tab.kind !== "terminal" || tab.private) return null;
    const terminal = terminalRefs.current.get(tab.activeLeafId);
    if (!terminal) return null;
    return {
      kind: "terminal-pane",
      tabId: tab.id,
      terminalId: tab.activeLeafId,
    };
  }, [activeId]);

  const captureVoiceVocabulary = useCallback(async (): Promise<string> => {
    if (!activeWorkspaceFolder) return "";
    const folder = activeWorkspaceFolder.replace(/[\\/]+$/, "");
    const names = ["package.json", "Cargo.toml", "go.mod", "pyproject.toml"];
    const manifests = await Promise.all(
      names.map(async (name) => {
        try {
          const result = await native.readFile(`${folder}/${name}`);
          return result.kind === "text" ? { name, content: result.content } : null;
        } catch {
          return null;
        }
      }),
    );
    return developerVocabularyFromWorkspace(
      activeWorkspaceFolder,
      manifests.filter(
        (manifest): manifest is { name: string; content: string } => manifest !== null,
      ),
    );
  }, [activeWorkspaceFolder]);

  const insertVoiceDraft = useCallback(
    (target: SpeechInputTarget, draft: string): boolean => {
      const tab = tabsRef.current.find((item) => item.id === target.tabId);
      const nextDraft = draft.replace(/[\r\n]+$/, "");
      if (!nextDraft) return false;
      if (target.kind === "canvas-terminal") {
        if (
          !tab ||
          tab.kind !== "architecture" ||
          !tab.diagram?.nodes.some(
            (item) =>
              item.id === target.terminalId && item.kind === "terminal",
          )
        ) {
          return false;
        }
        const terminal = canvasTerminalRefs.current.get(
          canvasTerminalRefKey(target.tabId, target.terminalId),
        );
        if (!terminal || !terminal.replaceCurrentInput(nextDraft)) return false;
        terminal.focus();
        return true;
      }
      if (
        !tab ||
        tab.kind !== "terminal" ||
        tab.private ||
        !leafIds(tab.paneTree).includes(target.terminalId)
      ) {
        return false;
      }
      const terminal = terminalRefs.current.get(target.terminalId);
      if (!terminal) return false;
      if (!terminal.replaceCurrentInput(nextDraft)) return false;
      pendingVoiceDraftsRef.current.set(target.terminalId, nextDraft);
      terminal.focus();
      return true;
    },
    [],
  );

  const toggleVoiceAgent = useCallback(() => {
    voiceAgentRef.current?.toggle();
  }, []);

  const maximizeActivePane = useCallback(() => {
    if (activeTerminalTab) {
      toggleMaximizePane(activeTerminalTab.activeLeafId);
    }
  }, [activeTerminalTab, toggleMaximizePane]);

  useEffect(() => {
    const unlisten = listen("cmdspace:maximize-pane", maximizeActivePane);

    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [maximizeActivePane]);

  const shortcutHandlers = useMemo<ShortcutHandlers>(
    () => ({
      "tab.new": openNewTab,
      "tab.newPrivate": openNewPrivateTab,
      "tab.newPreview": () => openPreviewTab(""),
      "tab.newEditor": () => setNewEditorOpen(true),
      "tab.newGitGraph": () => {
        if (sourceControl.hasRepo) void openGitGraphFromContext();
      },
      "tab.newArchitecture": () => newArchitectureTab(),
      "tab.close": handleCloseTabOrPane,
      "tab.next": () => cycleTab(1),
      "tab.prev": () => cycleTab(-1),
      "tab.selectByIndex": (e) => selectByIndex(parseInt(e.key, 10) - 1),
      "pane.splitRight": () => splitActivePaneInActiveTab("row"),
      "pane.splitDown": () => splitActivePaneInActiveTab("col"),
      "pane.focusNext": () => focusNextPaneInTab(activeId, 1),
      "pane.focusPrev": () => focusNextPaneInTab(activeId, -1),
      "pane.maximize": maximizeActivePane,
      "pane.close": () => {
        if (activeTab?.kind === "terminal") closeActivePane(activeId);
      },
      "pane.source": toggleSourceControl,
      "search.focus": () => searchInlineRef.current?.focus(),
      "terminal.bottom": toggleBottomTerminal,
      "music.open": openTopMusicTab,
      "voice.toggle": toggleVoiceAgent,
      "shortcuts.open": () => setShortcutsOpen((v) => !v),
      "settings.open": () => void openSettingsWindow(),
      "sidebar.toggle": toggleSidebar,
      "explorer.focus": toggleExplorerFocus,
      "view.zoomIn": zoomIn,
      "view.zoomOut": zoomOut,
      "view.zoomReset": zoomReset,
      "editor.undo": () => editorRefs.current.get(activeId)?.undo(),
      "editor.redo": () => editorRefs.current.get(activeId)?.redo(),
      "workspace.next": () => cycleWorkspace(1),
      "workspace.prev": () => cycleWorkspace(-1),
      "pane.focusLeft": () => focusDirectionalPane("left"),
      "pane.focusRight": () => focusDirectionalPane("right"),
      "pane.focusUp": () => focusDirectionalPane("up"),
      "pane.focusDown": () => focusDirectionalPane("down"),
    }),
    [
      activeId,
      cycleTab,
      handleCloseTabOrPane,
      newArchitectureTab,
      openGitGraphFromContext,
      openNewTab,
      openNewPrivateTab,
      openPreviewTab,
      selectByIndex,
      sourceControl.hasRepo,
      splitActivePaneInActiveTab,
      focusNextPaneInTab,
      maximizeActivePane,
      closeActivePane,
      toggleMaximizePane,
      toggleSourceControl,
      toggleBottomTerminal,
      openTopMusicTab,
      toggleVoiceAgent,
      toggleSidebar,
      toggleExplorerFocus,
      zoomIn,
      zoomOut,
      zoomReset,
      cycleWorkspace,
      focusDirectionalPane,
    ],
  );

  const shortcutsDisabled = useCallback(
    (id: ShortcutId, _event: KeyboardEvent) => {
      if (id === "editor.undo" || id === "editor.redo") {
        if (explorerRef.current?.isFocused()) return true;
        return activeTab?.kind !== "editor";
      }
      if (id === "pane.close") return activeTab?.kind !== "terminal";
      if (id === "tab.newGitGraph") {
        return !sourceControl.hasRepo;
      }
      // Canvas owns Cmd+Arrow / Cmd+> for terminal-node navigation;
      // let the canvas keydown handler consume them instead of pane shortcuts.
      if (
        activeTab?.kind === "architecture" &&
        (id === "pane.focusLeft" ||
          id === "pane.focusRight" ||
          id === "pane.focusUp" ||
          id === "pane.focusDown" ||
          id === "pane.maximize")
      ) {
        return true;
      }
      return false;
    },
    [activeTab, sourceControl.hasRepo],
  );

  useGlobalShortcuts(shortcutHandlers, { isDisabled: shortcutsDisabled });

  const registerTerminalHandle = useCallback(
    (leafId: number, h: TerminalPaneHandle | null) => {
      if (h) terminalRefs.current.set(leafId, h);
      else terminalRefs.current.delete(leafId);
    },
    [],
  );

  const registerEditorHandle = useCallback(
    (id: number, h: EditorPaneHandle | null) => {
      if (h) editorRefs.current.set(id, h);
      else editorRefs.current.delete(id);
      if (id === activeId) setActiveEditorHandle(h);
    },
    [activeId],
  );

  const registerPreviewHandle = useCallback(
    (id: number, h: PreviewPaneHandle | null) => {
      if (h) previewRefs.current.set(id, h);
      else previewRefs.current.delete(id);
    },
    [],
  );

  const handlePreviewUrl = useCallback(
    (id: number, url: string) => updateTab(id, { url }),
    [updateTab],
  );

  const handleTerminalCwd = useCallback(
    (leafId: number, cwd: string) => {
      setLeafCwd(leafId, cwd);
      // Persist to DB if it's a workspace
      const tab = tabsRef.current.find(
        (t) =>
          t.kind === "terminal" && hasLeaf((t as TerminalTab).paneTree, leafId),
      ) as TerminalTab | undefined;
      if (tab) {
        const ws = workspacesRef.current.find((w) => w.tabId === tab.id)
          ?? workspacesRef.current.find((w) => w.id === activeWorkspaceId);
        if (ws) {
          const paneIndex = leafIds(tab.paneTree).indexOf(leafId);
          if (paneIndex !== -1) {
            const lastCommand =
              findLeafLastCommand(tab.paneTree, leafId) ?? null;
            const autoLaunch = findLeafAutoLaunch(tab.paneTree, leafId);
            const existingPane = persistedPaneFor(ws.id, paneIndex);
            void persistPaneRecord(
              paneRecordFromCommand(
                ws.id,
                paneIndex,
                cwd,
                autoLaunch ? lastCommand : null,
                autoLaunch,
                existingPane,
              ),
            ).catch((err) => {
              console.error("Failed to save terminal pane cwd to DB:", err);
            });
          }
        }
      }
    },
    [persistPaneRecord, persistedPaneFor, setLeafCwd],
  );

  const changeTerminalDirectory = useCallback(
    (path: string) => {
      const nextPath = path.trim();
      if (activeLeafId === null || !nextPath) return;

      // A coding CLI owns stdin after launch, so typing `cd` into the PTY is
      // treated as agent input. Persist the pane's cwd and respawn the PTY,
      // which starts the shell/agent directly in the selected directory.
      handleTerminalCwd(activeLeafId, nextPath);
      void respawnSession(activeLeafId, nextPath, true);
      terminalRefs.current.get(activeLeafId)?.focus();
    },
    [activeLeafId, handleTerminalCwd],
  );

  const handleSwitchTerminalAgent = useCallback(
    (leafId: number, command: string | null) => {
      const tab = tabsRef.current.find(
        (item) => item.kind === "terminal" && hasLeaf(item.paneTree, leafId),
      );
      if (!tab || tab.kind !== "terminal") return;

      const cwd = findLeafCwd(tab.paneTree, leafId) ?? tab.cwd;
      setLeafLaunchCommand(leafId, command);

      const workspace = workspacesRef.current.find(
        (item) => item.tabId === tab.id,
      ) ?? workspacesRef.current.find((item) => item.id === activeWorkspaceId);
      if (workspace) {
        const paneIndex = leafIds(tab.paneTree).indexOf(leafId);
          if (paneIndex !== -1) {
            workspacePaneLaunchAtRef.current.set(`${workspace.id}:${paneIndex}`, Date.now());
            const pane = paneRecordFromCommand(
            workspace.id,
            paneIndex,
            cwd ?? null,
            command,
            Boolean(command),
            persistedPaneFor(workspace.id, paneIndex),
            null,
            false,
          );
          void persistPaneRecord(pane).catch((error) => {
            console.error("Failed to save switched terminal agent:", error);
          });
          if (pane.agentProvider && !pane.nativeSessionId) {
            scheduleWorkspacePaneSessionSync(
              workspace.id,
              cwd ?? workspace.workingFolder,
            );
          }
        }
      }

      void replaceSessionCommand(leafId, cwd, command).finally(() => {
        terminalRefs.current.get(leafId)?.focus();
      });
    },
    [activeWorkspaceId, persistPaneRecord, persistedPaneFor, scheduleWorkspacePaneSessionSync, setLeafLaunchCommand],
  );

  const handleTerminalCommand = useCallback(
    (leafId: number, command: string) => {
      pendingVoiceDraftsRef.current.delete(leafId);
      // Preserve coding-agent launches so workspace restoration can resolve
      // their native session from the provider's local session index.
      const tab = tabsRef.current.find(
        (t) =>
          t.kind === "terminal" && hasLeaf((t as TerminalTab).paneTree, leafId),
      ) as TerminalTab | undefined;
      if (tab) {
        const ws = workspacesRef.current.find((w) => w.tabId === tab.id);
        if (ws) {
          const paneIndex = leafIds(tab.paneTree).indexOf(leafId);
          if (paneIndex !== -1) {
          const workingFolder = findLeafCwd(tab.paneTree, leafId) ?? null;
          const autoLaunch = findLeafAutoLaunch(tab.paneTree, leafId);
          const isCliAgent = detectCliAgent(command) !== null;
          if (isCliAgent) {
            setLeafLaunchCommand(leafId, command);
            workspacePaneLaunchAtRef.current.set(`${ws.id}:${paneIndex}`, Date.now());
          }
          const existingPane = persistedPaneFor(ws.id, paneIndex);
          const configuredCommand = isCliAgent
            ? command
              : autoLaunch
                ? ((existingPane?.lastCommand ??
                    findLeafLastCommand(tab.paneTree, leafId)) ?? null)
                : null;
            const pane = paneRecordFromCommand(
              ws.id,
              paneIndex,
              workingFolder,
              configuredCommand,
              isCliAgent || autoLaunch,
              existingPane,
              null,
              !isCliAgent,
            );
            void persistPaneRecord(pane).catch((err) => {
              console.error("Failed to save terminal pane command to DB:", err);
            });
            if (pane.agentProvider && !pane.nativeSessionId) {
              scheduleWorkspacePaneSessionSync(
                ws.id,
                workingFolder ?? ws.workingFolder,
              );
            }
          }
        }
      }
    },
    [activeWorkspaceId, persistPaneRecord, persistedPaneFor, scheduleWorkspacePaneSessionSync],
  );

  const { handleTerminalPaneTreeChange, handleArchitectureDiagramChange } =
    useWorkspacePersistence<WorkspaceRecord>({
      workspacesRef,
      setTerminalPaneTree,
      updateTab,
      setWorkspaces,
      persistWorkspace: (workspace) => invoke("db_save_workspace", { workspace }),
      persistTerminalPanes: (workspace, paneTree) => {
        const paneIds = leafIds(paneTree);
        void Promise.all(
          paneIds.map((leafId, paneIndex) =>
            persistPaneRecord(
              paneRecordFromCommand(
                workspace.id,
                paneIndex,
                findLeafCwd(paneTree, leafId) ?? workspace.workingFolder,
                findLeafLastCommand(paneTree, leafId) ?? null,
                findLeafAutoLaunch(paneTree, leafId),
                persistedPaneFor(workspace.id, paneIndex),
              ),
            ),
          ),
        ).catch((error) => {
          console.error("Failed to persist split terminal panes:", error);
        });
      },
    });
  persistCanvasDiagramRef.current = handleArchitectureDiagramChange;

  const handleSwapWorkspaceTerminals = useCallback(
    (sourceId: number, targetId: number) => {
      const tab = tabsRef.current.find(
        (item) =>
          item.kind === "terminal" &&
          hasLeaf(item.paneTree, sourceId) &&
          hasLeaf(item.paneTree, targetId),
      );
      if (!tab || tab.kind !== "terminal") return;
      const paneTree = swapLeafNodes(tab.paneTree, sourceId, targetId);
      if (paneTree === tab.paneTree) return;
      handleTerminalPaneTreeChange(tab.id, paneTree);
      focusPane(tab.id, sourceId);
    },
    [focusPane, handleTerminalPaneTreeChange],
  );

  const handleFocusLeaf = useCallback(
    (tabId: number, leafId: number) => {
      clearAgentCompleted(leafId);
      focusPane(tabId, leafId);
    },
    [focusPane],
  );

  const handleSelectWorkspaceTerminal = useCallback(
    (workspaceId: string, leafId: number) => {
      const workspace = workspacesRef.current.find(
        (item) => item.id === workspaceId,
      );
      if (workspace?.tabId === null || workspace?.tabId === undefined) {
        if (workspace?.canvasTabId !== null && workspace?.canvasTabId !== undefined) {
          const canvasTab = tabsRef.current.find((item) => item.id === workspace.canvasTabId);
          if (canvasTab?.kind === "architecture") {
            const terminalNodes = canvasTab.diagram?.nodes.filter((node) => node.kind === "terminal") ?? [];
            const node = terminalNodes[-leafId - 1];
            if (node) {
              activeCanvasTerminalIds.current.set(canvasTab.id, node.id);
              setCanvasTerminalSelectionVersion((version) => version + 1);
            }
          }
          setActiveId(workspace.canvasTabId);
          return;
        }
        pendingWorkspaceTerminalRef.current = { workspaceId, leafId };
        handleSelectWorkspace(workspaceId);
        return;
      }
      const tab = tabsRef.current.find((item) => item.id === workspace.tabId);
      if (tab?.kind !== "terminal" || !hasLeaf(tab.paneTree, leafId)) return;
      clearAgentCompleted(leafId);
      setActiveId(tab.id);
      focusPane(tab.id, leafId);
    },
    [focusPane, handleSelectWorkspace],
  );

  useEffect(() => {
    const pending = pendingWorkspaceTerminalRef.current;
    if (!pending) return;
    const workspace = workspacesRef.current.find((item) => item.id === pending.workspaceId);
    if (!workspace?.tabId) return;
    const tab = tabsRef.current.find((item) => item.id === workspace.tabId);
    if (tab?.kind !== "terminal" || !hasLeaf(tab.paneTree, pending.leafId)) return;
    pendingWorkspaceTerminalRef.current = null;
    clearAgentCompleted(pending.leafId);
    setActiveId(tab.id);
    focusPane(tab.id, pending.leafId);
  }, [focusPane, tabs, workspaces]);

  const handleCreateWorkspaceTerminal = useCallback(
    (initialCommand = "") => {
      const workspace = workspacesRef.current.find(
        (item) => item.id === activeWorkspaceId,
      );
      if (!workspace) return false;

      if (workspace.workspaceMode === "agent") {
        const provider = detectCliAgent(initialCommand);
        if (!provider) return false;
        const currentAgentTabs = tabsRef.current.filter(
          (tab) =>
            tab.kind === "agent-chat" &&
            (tab.id === workspace.tabId || workspace.agentTabIds?.includes(tab.id)),
        );
        if (currentAgentTabs.length >= MAX_PANES_PER_TAB) return false;
        const tabId = newAgentChatTab({
          title: `${workspace.name} · ${currentAgentTabs.length + 1}`,
          provider,
          cwd: workspace.workingFolder ?? "",
          nativeSessionId: null,
          chatId: `${workspace.id}:chat:${currentAgentTabs.length + 1}`,
        });
        const agentTabIds = [...(workspace.agentTabIds ?? []), tabId];
        const agentProviders = [...(workspace.agentProviders ?? []), provider];
        const agentSessionIds = [...(workspace.agentSessionIds ?? []), null];
        const agentChatIds = [
          ...(workspace.agentChatIds ?? []),
          `${workspace.id}:chat:${currentAgentTabs.length + 1}`,
        ];
        const updated: WorkspaceRecord = {
          ...workspace,
          tabId: workspace.tabId ?? tabId,
          agentTabIds,
          agentProviders,
          agentSessionIds,
          agentChatIds,
          count: agentTabIds.length,
          updatedAt: Date.now(),
        };
        setWorkspaces((current) =>
          current.map((item) => (item.id === workspace.id ? updated : item)),
        );
        saveRecentWorkspace(updated);
        void invoke("db_save_workspace", { workspace: updated }).catch((error) => {
          console.error("Failed to persist created agent chat:", error);
        });
        setActiveId(tabId);
        return true;
      }

      if (workspace.workspaceMode === "canvas") {
        const canvasTabId = workspace.canvasTabId;
        if (canvasTabId === null || canvasTabId === undefined) return false;
        const creator = canvasTerminalCreatorRef.current.get(canvasTabId);
        if (!creator) return false;
        return creator(initialCommand || undefined);
      }

      if (workspace.tabId === null) return false;

      const workspaceTab = tabsRef.current.find(
        (item) => item.id === workspace.tabId,
      );
      if (workspaceTab?.kind !== "terminal") return false;

      const appended = appendTerminalPane(
        workspace.tabId,
        workspace.workingFolder ?? workspaceTab.cwd,
        initialCommand,
      );
      if (!appended) {
        return false;
      }

      const updated: WorkspaceRecord = {
        ...workspace,
        count: leafIds(appended.paneTree).length,
        paneLayout: JSON.stringify(appended.paneTree),
        updatedAt: Date.now(),
      };
      setWorkspaces((current) =>
        current.map((item) => (item.id === workspace.id ? updated : item)),
      );
      saveRecentWorkspace(updated);

      const leafOrder = leafIds(appended.paneTree);
      void Promise.all([
        invoke("db_save_workspace", { workspace: updated }),
        ...leafOrder.map((leafId, paneIndex) =>
          persistPaneRecord(
            paneRecordFromCommand(
              workspace.id,
              paneIndex,
              findLeafCwd(appended.paneTree, leafId) ?? workspace.workingFolder,
              findLeafLastCommand(appended.paneTree, leafId) ?? null,
              findLeafAutoLaunch(appended.paneTree, leafId),
              persistedPaneFor(workspace.id, paneIndex),
            ),
          ),
        ),
      ]).catch((error) => {
        console.error("Failed to persist created workspace terminal:", error);
      });
      if (initialCommand && detectCliAgent(initialCommand)) {
        scheduleWorkspacePaneSessionSync(
          workspace.id,
          workspace.workingFolder ?? workspaceTab.cwd ?? null,
        );
      }
      return true;
    },
    [
      activeWorkspaceId,
      appendTerminalPane,
      persistPaneRecord,
      persistedPaneFor,
      saveRecentWorkspace,
      scheduleWorkspacePaneSessionSync,
      newAgentChatTab,
      setActiveId,
    ],
  );

  const handleLeafExit = useCallback(
    (leafId: number, _code: number) => {
      const all = tabsRef.current;
      const tab = all.find(
        (t) => t.kind === "terminal" && hasLeaf(t.paneTree, leafId),
      );
      if (!tab || tab.kind !== "terminal") return;
      const isLast =
        leafIds(tab.paneTree).length === 1 &&
        all.filter((t) => t.kind === "terminal").length === 1;
      if (isLast) {
        void respawnSession(leafId, tab.cwd);
      } else {
        if (leafIds(tab.paneTree).length === 1) {
          clearWorkspaceTabOwnership(tab.id);
        }
        closePaneByLeaf(leafId);
      }
    },
    [clearWorkspaceTabOwnership, closePaneByLeaf],
  );

  const handleEditorDirty = useCallback(
    (id: number, dirty: boolean) => updateTab(id, { dirty }),
    [updateTab],
  );

  const searchTarget = useMemo<SearchTarget>(() => {
    if (isTerminalTab && activeLeafId !== null && activeSearchAddon)
      return {
        kind: "terminal",
        addon: activeSearchAddon,
        focus: () => terminalRefs.current.get(activeLeafId)?.focus(),
      };
    if (isEditorTab && activeEditorHandle)
      return {
        kind: "editor",
        handle: activeEditorHandle,
        focus: () => activeEditorHandle.focus(),
      };
    if (isGitHistoryTab && gitHistoryHandle)
      return {
        kind: "git-history",
        handle: gitHistoryHandle,
        focus: () => {},
      };
    return null;
  }, [
    isTerminalTab,
    isEditorTab,
    isGitHistoryTab,
    activeLeafId,
    activeSearchAddon,
    activeEditorHandle,
    gitHistoryHandle,
  ]);

  const activeCwd = activeTerminalLeafCwd;

  const handleImportAgentSession = useCallback(
    async (session: ImportableAgentSession): Promise<boolean> => {
      if (session.active) return false;
      const workspace = workspacesRef.current.find(
        (item) => item.id === activeWorkspaceId,
      );
      if (!workspace) return false;

      const initialCommand = buildSessionResumeCommand(
        session.provider,
        session.sessionId,
      );

      if (workspace.workspaceMode === "canvas") {
        const tab = tabsRef.current.find(
          (item) => item.id === workspace.canvasTabId,
        );
        if (!tab || tab.kind !== "architecture") return false;
        const diagram = tab.diagram ?? { nodes: [], edges: [] };
        if (
          diagram.nodes.some(
            (node) =>
              node.kind === "terminal" &&
              node.initialCommand === initialCommand,
          )
        ) {
          window.alert("This agent session is already open in the workspace.");
          return false;
        }
        const terminalIndex = diagram.nodes.filter(
          (node) => node.kind === "terminal",
        ).length;
        if (terminalIndex >= MAX_PANES_PER_TAB) {
          window.alert(`Workspace terminal limit reached (${MAX_PANES_PER_TAB}).`);
          return false;
        }
        const terminalWidth = 620;
        const terminalHeight = 400;
        const gap = 48;
        const nextDiagram: ArchitectureDiagram = {
          ...diagram,
          nodes: [
            ...diagram.nodes,
            {
              id: `imported-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              kind: "terminal",
              label: `${session.provider} session`,
              technology: "",
              x: 96 + (terminalIndex % 2) * (terminalWidth + gap),
              y: 96 + Math.floor(terminalIndex / 2) * (terminalHeight + gap),
              width: terminalWidth,
              height: terminalHeight,
              cwd: session.cwd,
              initialCommand,
              terminalChromeVersion: 2,
            },
          ],
        };
        handleArchitectureDiagramChange(tab.id, nextDiagram);
        setActiveId(tab.id);
        return true;
      }

      if (workspace.tabId === null) return false;
      const workspaceTab = tabsRef.current.find(
        (item) => item.id === workspace.tabId,
      );
      if (
        workspaceTab?.kind === "terminal" &&
        leafIds(workspaceTab.paneTree).some(
          (leafId) =>
            findLeafLastCommand(workspaceTab.paneTree, leafId) ===
            initialCommand,
        )
      ) {
        window.alert("This agent session is already open in the workspace.");
        return false;
      }
      const appended = appendTerminalPane(
        workspace.tabId,
        session.cwd,
        initialCommand,
      );
      if (!appended) {
        window.alert(`Workspace terminal limit reached (${MAX_PANES_PER_TAB}).`);
        return false;
      }

      const updated: WorkspaceRecord = {
        ...workspace,
        count: leafIds(appended.paneTree).length,
        paneLayout: JSON.stringify(appended.paneTree),
        updatedAt: Date.now(),
      };
      setWorkspaces((current) =>
        current.map((item) => (item.id === workspace.id ? updated : item)),
      );
      saveRecentWorkspace(updated);

      const leafOrder = leafIds(appended.paneTree);
      void Promise.all([
        invoke("db_save_workspace", { workspace: updated }),
        ...leafOrder.map((leafId, paneIndex) =>
          persistPaneRecord(
            paneRecordFromCommand(
              workspace.id,
              paneIndex,
              findLeafCwd(appended.paneTree, leafId) ?? workspace.workingFolder,
              findLeafLastCommand(appended.paneTree, leafId) ?? null,
              findLeafAutoLaunch(appended.paneTree, leafId),
              persistedPaneFor(workspace.id, paneIndex),
              paneIndex === leafOrder.length - 1 ? session.sessionId : null,
            ),
          ),
        ),
      ]).catch((error) => {
        console.error("Failed to persist imported agent session pane:", error);
      });
      scheduleWorkspacePaneSessionSync(
        workspace.id,
        workspace.workingFolder ?? session.cwd,
      );
      return true;
    },
    [
      activeWorkspaceId,
      appendTerminalPane,
      handleArchitectureDiagramChange,
      persistPaneRecord,
      persistedPaneFor,
      saveRecentWorkspace,
      scheduleWorkspacePaneSessionSync,
      setActiveId,
    ],
  );

  const hideBootstrapShell = shouldSuppressBootstrapShell({
    activeTabId: activeTab?.id ?? null,
    activeWorkspaceId,
    workspacesHydrated,
    initialWorkspaceActivationHandled:
      initialWorkspaceActivationHandledRef.current,
    pendingBootstrapClose: pendingBootstrapCloseRef.current,
  });
  const workspaceLoadingPresentation = getWorkspaceLoadingPresentation({
    activeTabId: activeTab?.id ?? null,
    activeWorkspaceId,
    workspacesHydrated,
    initialWorkspaceActivationHandled:
      initialWorkspaceActivationHandledRef.current,
    pendingBootstrapClose: pendingBootstrapCloseRef.current,
    openingWorkspaceId,
  });
  const showWorkspaceSwitchLoading = workspaceLoadingPresentation === "local";
  const openingWorkspace =
    openingWorkspaceId === null
      ? null
      : workspaces.find((workspace) => workspace.id === openingWorkspaceId) ??
        null;
  const workspaceLoadingLabel = openingWorkspace
    ? `Opening ${openingWorkspace.name}…`
    : "Opening workspace…";
  if (hideBootstrapShell) {
    return (
      <ThemeProvider>
        <TooltipProvider>
          <div className="flex h-screen items-center justify-center bg-background text-foreground">
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm shadow-sm">
              <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
              <span>{workspaceLoadingLabel}</span>
            </div>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    );
  }
  const renderedTabs = hideBootstrapShell
    ? tabs.filter((tab) => tab.id !== 1)
    : tabs;

  const workspaceSurface = (
    <div className="relative h-full min-h-0">
      <div
        className={cn(
          "absolute inset-0",
          (!isTerminalTab || hideBootstrapShell) && "invisible pointer-events-none",
        )}
        aria-hidden={!isTerminalTab || hideBootstrapShell}
      >
        <TerminalStack
          tabs={tabs}
          activeId={activeId}
          registerHandle={registerTerminalHandle}
          onSearchReady={handleSearchReady}
          onCwd={handleTerminalCwd}
          onChangeDirectory={changeTerminalDirectory}
          onExit={handleLeafExit}
          onCommand={handleTerminalCommand}
          onSwitchAgent={handleSwitchTerminalAgent}
          onFocusLeaf={handleFocusLeaf}
          onCloseLeaf={closePaneByLeaf}
          onToggleMaximize={toggleMaximizePane}
          onSplitPane={splitActivePaneInActiveTab}
          focusAccentColor={activeWorkspaceAccentColor}
          onPaneTreeChange={handleTerminalPaneTreeChange}
        />
      </div>
      {tabs.flatMap((tab) => {
        if (tab.kind !== "agent-chat") return [];
        const workspace = workspaces.find(
          (item) =>
            item.tabId === tab.id || item.agentTabIds?.includes(tab.id),
        );
        if (!workspace) return [];
        const active = tab.id === activeId;
        return [
          <div
            key={tab.id}
            className={cn(
              "absolute inset-0",
              !active && "invisible pointer-events-none",
            )}
            aria-hidden={!active}
          >
            <AgentChatWorkspace
              workspaceId={workspace.id}
              chatId={tab.chatId}
              active={active}
              provider={tab.provider}
              cwd={tab.cwd}
              nativeSessionId={tab.nativeSessionId}
              apiKeys={apiKeys}
              initialDraft={tab.initialDraft}
              initialHistoryAttachments={tab.initialHistoryAttachments}
              onForkResponse={(destination, response) => handleForkAgentResponse({
                workspaceId: workspace.id,
                provider: tab.provider,
                cwd: tab.cwd,
                destination,
                attachment: response,
              })}
              onNativeSessionId={(nativeSessionId) =>
                handleAgentNativeSessionId(
                  workspace.id,
                  tab.id,
                  tab.chatId,
                  tab.provider,
                  nativeSessionId,
                )
              }
            />
          </div>,
        ];
      })}
      <div
        data-editor-file-drop-region
        className={cn(
          "absolute inset-0",
          !isEditorTab && "invisible pointer-events-none",
        )}
        aria-hidden={!isEditorTab}
      >
        <EditorStack
          tabs={tabs}
          activeId={activeId}
          registerHandle={registerEditorHandle}
          onDirtyChange={handleEditorDirty}
          onCloseTab={disposeTab}
        />
      </div>
      <div
        className={cn(
          "absolute inset-0",
          !isPreviewTab && "invisible pointer-events-none",
        )}
        aria-hidden={!isPreviewTab}
      >
        <PreviewStack
          tabs={tabs}
          activeId={activeId}
          registerHandle={registerPreviewHandle}
          onUrlChange={handlePreviewUrl}
        />
      </div>
      <div
        className={cn(
          "absolute inset-0",
          !isMarkdownTab && "invisible pointer-events-none",
        )}
        aria-hidden={!isMarkdownTab}
      >
        <MarkdownStack tabs={tabs} activeId={activeId} />
      </div>
      <div
        className={cn(
          "absolute inset-0",
          !isAiDiffTab && "invisible pointer-events-none",
        )}
        aria-hidden={!isAiDiffTab}
      >
        <AiDiffStack
          tabs={tabs}
          activeId={activeId}
          onAccept={() => undefined}
          onReject={() => undefined}
        />
      </div>
      <div
        className={cn(
          "absolute inset-0",
          !isGitDiffTab && "invisible pointer-events-none",
        )}
        aria-hidden={!isGitDiffTab}
      >
        <GitDiffStack tabs={tabs} activeId={activeId} />
      </div>
      <div
        className={cn(
          "absolute inset-0",
          !isGitHistoryTab && "invisible pointer-events-none",
        )}
        aria-hidden={!isGitHistoryTab}
      >
        <GitHistoryStack
          tabs={tabs}
          activeId={activeId}
          onOpenCommitFile={openCommitFileDiffTab}
          onSearchHandle={setGitHistoryHandle}
        />
      </div>
      <div
        className={cn(
          "absolute inset-0",
          !isArchitectureTab && "hidden pointer-events-none",
        )}
        aria-hidden={!isArchitectureTab}
      >
          <ArchitectureStack
            tabs={tabs}
            activeId={activeId}
            onDiagramChange={handleArchitectureDiagramChange}
            onRegisterTerminalCreator={(tabId, creator) => {
              if (creator) canvasTerminalCreatorRef.current.set(tabId, creator);
              else canvasTerminalCreatorRef.current.delete(tabId);
            }}
          onTerminalHandleChange={onCanvasTerminalHandleChange}
          onActiveTerminalChange={onActiveCanvasTerminalChange}
          canvasFocused={canvasFocused}
          onToggleCanvasFocus={toggleCanvasFocus}
        />
      </div>
    </div>
  );

  const shell = (
    <ThemeProvider>
      <TooltipProvider>
        <div
          ref={mainShellRef}
          className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground"
        >
          <Header
            tabs={renderedTabs}
            activeId={activeId}
            onSelect={setActiveId}
            onReorder={reorderTab}
            onNew={openNewTab}
            onNewPrivate={openNewPrivateTab}
            onNewPreview={() => openPreviewTab("")}
            onNewEditor={() => setNewEditorOpen(true)}
            onNewGitGraph={openGitGraphFromContext}
            canNewGitGraph={sourceControl.hasRepo}
            onNewArchitecture={newArchitectureTab}
            onNewMusic={openTopMusicTab}
            onClose={handleClose}
            onPin={pinTab}
            onToggleWorkspacesPanel={toggleWorkspacesPanel}
            onToggleSidebar={toggleSidebar}
            onSplit={splitActivePaneInActiveTab}
            canSplit={
              activeTerminalTab !== null &&
              leafIds(activeTerminalTab.paneTree).length < MAX_PANES_PER_TAB
            }
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onOpenSettings={() => void openSettingsWindow()}
            searchTarget={searchTarget}
            searchRef={searchInlineRef}
          />

          <main className="relative min-h-0 flex-1 overflow-hidden">
            <div className="zoom-content absolute left-0 top-0 flex min-h-0">
              <div
                className={cn(
                  "min-h-0 shrink-0 overflow-hidden",
                  workspacesPanelResizing
                    ? "transition-none"
                    : "transition-[width] duration-150 ease-out",
                )}
                style={{
                  width: workspacesPanelOpen ? workspacesPanelWidth : 0,
                }}
              >
                <div className="h-full" style={{ width: workspacesPanelWidth }}>
                  <WorkspacesPanel
                    activeWorkspaceId={activeWorkspaceId}
                    activeWorkspaceTerminals={activeWorkspaceTerminals}
                    onSelectTerminal={handleSelectWorkspaceTerminal}
                    onSelectTab={setActiveId}
                    onSwapTerminals={handleSwapWorkspaceTerminals}
                    onCreateTerminal={handleCreateWorkspaceTerminal}
                    compact={workspacesPanelCompact}
                    workspaces={workspaceItems}
                    onSelectWorkspace={handleSelectWorkspace}
                    onCloseWorkspace={handleCloseWorkspace}
                    onRenameWorkspace={handleRenameWorkspace}
                    onChangeWorkspaceColor={handleChangeWorkspaceColor}
                    onStartWorkspaceSetup={() => setWorkspaceSetupOpen(true)}
                    onImportSession={() => setImportSessionOpen(true)}
                    onReorderWorkspaces={handleReorderWorkspaces}
                  />
                </div>
              </div>
              <div
                role="separator"
                aria-label={
                  workspacesPanelOpen
                    ? "Resize workspaces panel"
                    : "Open workspaces panel"
                }
                aria-orientation="vertical"
                aria-valuemin={0}
                aria-valuemax={WORKSPACES_PANEL_MAX_WIDTH}
                aria-valuenow={workspacesPanelOpen ? workspacesPanelWidth : 0}
                tabIndex={0}
                onPointerDown={handleWorkspacesPanelResizeStart}
                onKeyDown={handleWorkspacesPanelResizeKeyDown}
                className={cn(
                  "relative z-50 -mx-2 flex w-4 shrink-0 cursor-col-resize touch-none select-none bg-transparent outline-none after:pointer-events-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border/70 focus-visible:ring-1 focus-visible:ring-ring",
                  workspacesPanelCompact && "cursor-default focus-visible:ring-0",
                )}
              />
              <div
                ref={sidebarSplitRef}
                className={cn(
                  "flex min-h-0 min-w-0 flex-1",
                  (sidebarResizing || workspacesPanelResizing) &&
                    "cursor-col-resize select-none",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex h-full min-h-0 flex-col">
                    <div ref={workspaceRef} className="relative min-h-0 flex-1">
                      <div
                        className={cn(
                          "absolute inset-0",
                          workspaceSetupOpen && "invisible pointer-events-none",
                        )}
                        aria-hidden={workspaceSetupOpen}
                      >
                        {workspaceSurface}
                      </div>
                      {workspaceSetupOpen ? (
                        <div className="absolute inset-0 z-30 bg-background">
                          <WorkspaceSetupView
                          workingFolder={workspaceForkContext?.cwd ?? workspaceSetupFolder}
                          suggestedWorkspaceName={
                            nextWorkspaceName(workspaces) ?? "workspace"
                          }
                          suggestedWorkspaceColor={workspaceAccentForIndex(
                            workspaces.length,
                          )}
                          recentWorkspaces={recentWorkspaces}
                          forkContext={workspaceForkContext}
                          onCancel={handleWorkspaceSetupCancel}
                          onOpenWithoutAi={handleOpenWorkspaceWithoutAi}
                          />
                        </div>
                      ) : null}
                      {showWorkspaceSwitchLoading && !workspaceSetupOpen ? (
                        <div className="pointer-events-none absolute right-4 top-4 z-20">
                          <div
                            role="status"
                            aria-live="polite"
                            className="flex items-center gap-2 rounded-full border border-border/60 bg-card/95 px-3 py-2 text-sm shadow-sm backdrop-blur"
                          >
                            <span className="size-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
                            <span>{workspaceLoadingLabel}</span>
                          </div>
                        </div>
                      ) : null}
                      {bottomTerminalOpen ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40">
                          <div className="pointer-events-auto">
                            <BottomTerminalDrawer
                              ref={bottomTerminalRef}
                              cwd={bottomTerminalCwd}
                              codingAgentCount={activeWorkspaceCodingAgentCount}
                              onClose={() => setBottomTerminalOpen(false)}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div
                  role="separator"
                  aria-label={
                    sidebarOpen ? "Resize right sidebar" : "Open right sidebar"
                  }
                  aria-orientation="vertical"
                  aria-valuemin={0}
                  aria-valuemax={SIDEBAR_MAX_WIDTH}
                  aria-valuenow={sidebarOpen ? sidebarWidth : 0}
                  tabIndex={0}
                  onPointerDown={handleSidebarResizeStart}
                  onKeyDown={handleSidebarResizeKeyDown}
                  className={cn(
                    "relative z-50 -mx-2 flex w-4 shrink-0 cursor-col-resize touch-none select-none bg-transparent outline-none after:pointer-events-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border/70 focus-visible:ring-1 focus-visible:ring-ring",
                  )}
                />
                <aside
                  className={cn(
                    "min-h-0 shrink-0 overflow-hidden",
                    !sidebarOpen && "pointer-events-none",
                    sidebarResizing
                      ? "transition-none"
                      : "transition-[width] duration-150 ease-out",
                  )}
                  style={{ width: sidebarOpen ? sidebarWidth : 0 }}
                  aria-hidden={!sidebarOpen}
                >
                  <div
                    className="flex h-full min-h-0 shrink-0 flex-col bg-card"
                    style={{ width: sidebarWidth }}
                  >
                    <SidebarRail
                      placement="top"
                      activeView={sidebarView}
                      onSelectView={persistSidebarView}
                    />
                    <div className="min-h-0 flex-1">
                      {sidebarView === "browser" ? (
                        <div className="h-full min-h-0 p-2">
                          <SidebarBrowserPane
                            url={sidebarBrowserUrl}
                            visible={sidebarView === "browser"}
                            resizing={sidebarResizing}
                            onUrlChange={persistSidebarBrowserUrl}
                          />
                        </div>
                      ) : sidebarView === "editor" ? (
                        editorSidebarView === "files" ? (
                          <FileExplorer
                            ref={explorerRef}
                            rootPath={explorerRoot}
                            acceptExternalDrops={isEditorTab}
                            onOpenFile={handleOpenFile}
                            onPathRenamed={handlePathRenamed}
                            onPathDeleted={handlePathDeleted}
                            onRevealInTerminal={cdInNewTab}
                            onOpenMarkdownPreview={openMarkdownPreview}
                          />
                        ) : (
                          <SourceControlPanel
                            open={
                              sidebarView === "editor" &&
                              editorSidebarView === "source-control"
                            }
                            sourceControl={sourceControl}
                            onOpenGitGraph={openGitGraphFromContext}
                            onOpenDiff={openGitDiffTab}
                          />
                        )
                      ) : (
                        <div className="h-full min-h-0" />
                      )}
                    </div>
                    {sidebarView === "editor" ? (
                      <EditorSidebarRail
                        activeView={editorSidebarView}
                        onSelectView={setEditorSidebarView}
                      />
                    ) : null}
                  </div>
                </aside>
              </div>
            </div>
          </main>
          <ImportSessionDialog
            open={importSessionOpen}
            onOpenChange={setImportSessionOpen}
            workspaceName={activeWorkspace?.name ?? null}
            workspaceCwd={activeWorkspaceFolder}
            onImport={handleImportAgentSession}
          />

          <StatusBar
            cwd={activeCwd}
            filePath={activeFilePath}
            home={home}
            workspaceFolder={activeWorkspaceFolder}
            onCd={changeTerminalDirectory}
            onWorkspaceChange={switchWorkspace}
            onToggleTerminal={toggleBottomTerminal}
            privateActive={
              activeTab?.kind === "terminal" && activeTab.private === true
            }
          />

          <FloatingVoiceAgent
            ref={voiceAgentRef}
            captureTarget={captureVoiceTarget}
            captureVocabulary={captureVoiceVocabulary}
            apiKeys={apiKeys}
            insertTranscript={insertVoiceDraft}
          />

          <ShortcutsDialog
            open={shortcutsOpen}
            onOpenChange={setShortcutsOpen}
          />

          <NewEditorDialog
            open={newEditorOpen}
            onOpenChange={setNewEditorOpen}
            rootPath={explorerRoot ?? home}
            onCreated={(path) => openFileTab(path)}
          />

          <UpdaterDialog autoCheck={false} />

          <AlertDialog
            open={pendingCloseTab !== null}
            onOpenChange={(open) => !open && cancelClose()}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
                <AlertDialogDescription>
                  {tabs.find((t) => t.id === pendingCloseTab)?.title
                    ? `"${
                        tabs.find((t) => t.id === pendingCloseTab)?.title
                      }" has unsaved changes. Close anyway?`
                    : "This file has unsaved changes. Close anyway?"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelClose}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={confirmClose}>
                  Close Anyway
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={pendingDeleteWorkspaceId !== null}
            onOpenChange={(open) => !open && cancelDeleteWorkspace()}
          >
            <AlertDialogContent
              className="max-w-[calc(100%-2rem)] gap-5 rounded-[28px] p-5 shadow-2xl shadow-black/15 ring-black/5 sm:max-w-[420px]"
              overlayClassName="bg-black/20 supports-backdrop-filter:backdrop-blur-[2px]"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/15">
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    size={20}
                    strokeWidth={1.8}
                  />
                </div>
                <AlertDialogHeader className="min-w-0 place-items-start gap-1 text-left sm:place-items-start sm:text-left">
                  <AlertDialogTitle className="text-base leading-6 font-semibold">
                    Delete workspace?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm leading-5">
                    This will permanently remove{" "}
                    <span className="font-medium text-foreground">
                      {pendingDeleteWorkspace?.name ?? "this workspace"}
                    </span>{" "}
                    and close its terminal panes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
              </div>

              <Label className="group flex min-h-10 cursor-pointer items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
                <Checkbox
                  checked={workspaceDeleteDoNotAskAgain}
                  onCheckedChange={(checked) =>
                    setWorkspaceDeleteDoNotAskAgain(checked === true)
                  }
                  aria-label="Do not ask again before deleting workspaces"
                  className="bg-background shadow-sm group-hover:border-border"
                />
                <span>Do not ask again</span>
              </Label>

              <AlertDialogFooter className="gap-2 sm:justify-end">
                <AlertDialogCancel
                  variant="ghost"
                  onClick={cancelDeleteWorkspace}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  className="bg-destructive px-4 text-white shadow-sm shadow-destructive/20 hover:bg-destructive/90 focus-visible:border-destructive/50 focus-visible:ring-destructive/25"
                  onClick={confirmDeleteWorkspace}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={pendingDeleteTabs !== null}
            onOpenChange={(open) => !open && cancelDeleteClose()}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingDeleteTabs?.length === 1
                    ? (() => {
                        const title = tabs.find(
                          (t) => t.id === pendingDeleteTabs[0],
                        )?.title;
                        return title
                          ? `"${title}" has unsaved changes. The file has been deleted. Close anyway?`
                          : "This file has unsaved changes. The file has been deleted. Close anyway?";
                      })()
                    : `${pendingDeleteTabs?.length ?? 0} files have unsaved changes. They have been deleted. Close all anyway?`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelDeleteClose}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteClose}>
                  Close Anyway
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );

  return shell;
}
