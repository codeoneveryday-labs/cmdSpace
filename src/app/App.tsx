import { TooltipProvider } from "@/components/ui/tooltip";
import type { FloatingVoiceAgentHandle } from "@/modules/ai/components/FloatingVoiceAgent";
import {
  EMPTY_PROVIDER_KEYS,
  type ProviderKeys,
} from "@/modules/ai/lib/keyring";
import {
  type CanvasTerminalHandle,
} from "@/modules/architecture";
import type { EditorPaneHandle } from "@/modules/editor";
import type { GitHistorySearchHandle } from "@/modules/git-history";
import { getLaunchDir } from "@/lib/launchDir";
import { useZoom } from "@/lib/useZoom";
import { type FileExplorerHandle } from "@/modules/explorer";
import {
  Header,
  type SearchInlineHandle,
} from "@/modules/header";
import { type PreviewPaneHandle } from "@/modules/preview";
import { openSettingsWindow } from "@/modules/settings/openSettingsWindow";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { useGlobalShortcuts } from "@/modules/shortcuts";
import { useSourceControl } from "@/modules/source-control";
import {
  MAX_PANES_PER_TAB,
  useTabs,
  useWorkspaceCwd,
} from "@/modules/tabs";
import type { ArchitectureDiagram } from "@/modules/tabs";
import {
  findLeafAutoLaunch,
  findLeafCwd,
  findLeafLastCommand,
  leafIds,
  replaceSessionCommand,
  respawnSession,
  setTerminalResizePaused,
  BottomTerminalDrawer,
  type BottomTerminalDrawerHandle,
  type TerminalPaneHandle,
} from "@/modules/terminal";
import {
  useAgentBlockedLeaves,
  useAgentCliCommands,
  useAgentCompletedLeaves,
  useAgentResponseLeaves,
  useAgentResponseRequestedLeaves,
} from "@/modules/terminal/lib/agentActivity";
import { ThemeProvider } from "@/modules/theme";
import { WorkspaceSurface } from "./WorkspaceSurface";
import { AppShell } from "./AppShell";
import { AppOverlays } from "./AppOverlays";
import { useWorkspaceEnvStore } from "@/modules/workspace";
import { WorkspacesPanel, WorkspaceSetupView } from "@/modules/workspaces";
import { getAppStartupView } from "./lib/appStartupViewModel";
import { invoke } from "@tauri-apps/api/core";
import type { SearchAddon } from "@xterm/addon-search";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  WORKSPACE_DELETE_CONFIRM_STORAGE_KEY,
  WORKSPACES_PANEL_COMPACT_WIDTH,
} from "./constants";
import { useWorkspacePersistence } from "./lib/useWorkspacePersistence";
import { useAppLayout } from "./lib/useAppLayout";
import { useAppLayoutResize } from "./lib/useAppLayoutResize";
import {
  useWorkspaceController,
  type WorkspaceRecord,
} from "./lib/useWorkspaceController";
import { useWorkspaceSelectionController } from "./lib/useWorkspaceSelectionController";
import { useTerminalWorkspaceActions } from "./lib/useTerminalWorkspaceActions";
import { useTerminalPaneActions } from "./lib/useTerminalPaneActions";
import { useWorkspaceTerminalSelection } from "./lib/useWorkspaceTerminalSelection";
import { buildWorkspacePaneRecord } from "./lib/workspacePaneRecordModel";
import {
  buildCanvasWorkspaceDiagram,
  nextWorkspaceName,
  workspaceAccentForIndex,
} from "./lib/workspaceCreationModel";
import { useDirectionalPaneFocus } from "./lib/useDirectionalPaneFocus";
import {
  resolveActiveFilePath,
  resolveActiveTerminalLeafCwd,
} from "./lib/appContextModel";
import { clearTabOwnership } from "./lib/workspaceOwnershipModel";
import { nextWorkspaceIndex } from "./lib/workspaceNavigationModel";
import { useEditorExternalReload } from "./lib/useEditorExternalReload";
import { useAppRuntimeBootstrap } from "./lib/useAppRuntimeBootstrap";
import { useWorkspacePaneSessionSync } from "./lib/useWorkspacePaneSessionSync";
import {
  createAppShortcutDisabled,
  createAppShortcutHandlers,
} from "./lib/appShortcutCoordination";
import { useAppFileActions } from "./lib/useAppFileActions";
import { useAppSearchTarget } from "./lib/useAppSearchTarget";
import { useAppSearchRegistry } from "./lib/useAppSearchRegistry";
import { useAppActiveContext } from "./lib/useAppActiveContext";
import { useAppSourceControlContext } from "./lib/useAppSourceControlContext";
import { useAppPaneActions } from "./lib/useAppPaneActions";
import { useAppWorkspaceTerminalView } from "./lib/useAppWorkspaceTerminalView";
import { useAppWorkspaceItems } from "./lib/useAppWorkspaceItems";
import { usePreviewTabAction } from "./lib/usePreviewTabAction";
import { useAppChromeActions } from "./lib/useAppChromeActions";
import { useWorkspaceSessionImportAction } from "./lib/useWorkspaceSessionImportAction";
import { useWorkspaceTerminalCreationAction } from "./lib/useWorkspaceTerminalCreationAction";
import { useMusicTabAction } from "./lib/useMusicTabAction";
import { useWorkspaceDeletion } from "./lib/useWorkspaceDeletion";
import { useWorkspaceDeleteConfirmation } from "./lib/useWorkspaceDeleteConfirmation";
import { useAppTabClose } from "./lib/useAppTabClose";
import { useBootstrapTabCleanup } from "./lib/useBootstrapTabCleanup";
import { useAppAgentSessionIdentity } from "./lib/useAppAgentSessionIdentity";
import { useWorkspaceSetupActions } from "./lib/useWorkspaceSetupActions";
import { useWorkspaceSetupAutoOpen } from "./lib/useWorkspaceSetupAutoOpen";
import { useBottomTerminalController } from "./lib/useBottomTerminalController";
import { useAppTabNavigation } from "./lib/useAppTabNavigation";
import { useAppHandleRegistry } from "./lib/useAppHandleRegistry";
import { useCanvasTerminalHandleRegistry } from "./lib/useCanvasTerminalHandleRegistry";
import { useAppSourceControlActions } from "./lib/useAppSourceControlActions";
import { AppChrome } from "./AppChrome";
import { AppSidebar } from "./AppSidebar";
import { useLiveTerminalCleanup } from "./lib/useLiveTerminalCleanup";
import { useAppVoiceIntegration } from "./lib/useAppVoiceIntegration";
import { useAppWindowEvents } from "./lib/useAppWindowEvents";
import { useWorkspaceEnvironmentSwitch } from "./lib/useWorkspaceEnvironmentSwitch";
import { useSplitPanePersistence } from "./lib/useSplitPanePersistence";
import {
  useWorkspaceForkActions,
  type WorkspaceForkContext,
} from "./lib/useWorkspaceForkActions";

function canvasTerminalRefKey(tabId: number, terminalId: string): string {
  return `${tabId}:${terminalId}`;
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
  const closeTabActionRef = useRef<(tabId: number) => void>(() => undefined);
  tabsRef.current = tabs;

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
  useEditorExternalReload({ tabs, tabsRef, editorRefs });
  const previewRefs = useRef<Map<number, PreviewPaneHandle>>(new Map());
  const [activeEditorHandle, setActiveEditorHandle] =
    useState<EditorPaneHandle | null>(null);
  const [gitHistoryHandle, setGitHistoryHandle] =
    useState<GitHistorySearchHandle | null>(null);
  const { zoomIn, zoomOut, zoomReset } = useZoom();
  const explorerRef = useRef<FileExplorerHandle>(null);
  const explorerReturnFocusRef = useRef<HTMLElement | null>(null);

  const {
    mainShellRef,
    sidebarSplitRef,
    sidebarOpen,
    setSidebarOpen,
    sidebarWidth,
    setSidebarWidth,
    sidebarResizing,
    setSidebarResizing,
    sidebarView,
    persistSidebarView,
    editorSidebarView,
    setEditorSidebarView,
    sidebarBrowserUrl,
    persistSidebarBrowserUrl,
    workspacesPanelOpen,
    setWorkspacesPanelOpen,
    workspacesPanelResizing,
    setWorkspacesPanelResizing,
    workspacesPanelExpandedWidth,
    setWorkspacesPanelExpandedWidth,
    workspacesPanelCompact,
    sidebarWidthRef,
    workspacesPanelWidthRef,
    sidebarResizeStartRef,
    workspacesPanelResizeStartRef,
  } = useAppLayout();
  const workspacesPanelWidth = workspacesPanelCompact
    ? WORKSPACES_PANEL_COMPACT_WIDTH
    : workspacesPanelExpandedWidth;
  const {
    pauseTerminalResizeForChromeTransition,
    handleWorkspacesPanelResizeStart,
    handleWorkspacesPanelResizeKeyDown,
    handleSidebarResizeStart,
    handleSidebarResizeKeyDown,
  } = useAppLayoutResize({
    mainShellRef,
    sidebarSplitRef,
    sidebarResizeStartRef,
    workspacesPanelResizeStartRef,
    sidebarOpen,
    sidebarWidth,
    workspacesPanelOpen,
    workspacesPanelCompact,
    workspacesPanelWidth,
    workspacesPanelResizing,
    sidebarResizing,
    sidebarWidthRef,
    workspacesPanelWidthRef,
    setSidebarOpen,
    setSidebarWidth,
    setSidebarResizing,
    setWorkspacesPanelOpen,
    setWorkspacesPanelExpandedWidth,
    setWorkspacesPanelResizing,
    setTerminalResizePaused,
  });
  const {
    canvasFocused,
    toggleSidebar,
    toggleWorkspacesPanel,
    toggleCanvasFocus,
    cycleSidebarView,
    toggleExplorerFocus,
  } = useAppChromeActions({
    pauseTerminalResizeForChromeTransition,
    sidebarOpen,
    setSidebarOpen,
    workspacesPanelOpen,
    setWorkspacesPanelOpen,
    sidebarView,
    persistSidebarView,
    explorerRef,
    explorerReturnFocusRef,
  });

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
  const {
    workspaces,
    setWorkspaces,
    recentWorkspaces,
    persistedWorkspacePanes,
    setPersistedWorkspacePanes,
    persistedWorkspacePanesRef,
    workspacesHydrated,
    persistedPaneFor,
    persistPaneRecord,
    saveRecentWorkspace,
    renameWorkspace,
    changeWorkspaceColor,
    reorderWorkspaces,
    deleteWorkspace: removeWorkspace,
    createWorkspace,
    createWorkspaceTerminal,
    importAgentSession,
  } = useWorkspaceController({ updateTab });
  const reservedNativeSessionIdsRef = useRef<Map<string, string>>(new Map());
  const workspacePaneLaunchAtRef = useRef<Map<string, number>>(new Map());
  const workspacePaneSyncTimersRef = useRef<Map<string, number[]>>(new Map());
  const {
    syncWorkspacePaneNativeSessions,
    scheduleWorkspacePaneSessionSync,
  } = useWorkspacePaneSessionSync({
    persistedWorkspacePanesRef,
    reservedNativeSessionIdsRef,
    workspacePaneLaunchAtRef,
    workspacePaneSyncTimersRef,
    setPersistedWorkspacePanes,
    persistPaneRecord,
  });
  const [workspaceSetupOpen, setWorkspaceSetupOpen] = useState(false);
  const [workspaceForkContext, setWorkspaceForkContext] =
    useState<WorkspaceForkContext | null>(null);
  const [importSessionOpen, setImportSessionOpen] = useState(false);
  const workspacesRef = useRef(workspaces);
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

  useWorkspaceSetupAutoOpen({
    hydrated: workspacesHydrated,
    workspaceCount: workspaces.length,
    setSetupOpen: setWorkspaceSetupOpen,
  });

  const [pendingDeleteTabs, setPendingDeleteTabs] = useState<number[] | null>(
    null,
  );
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [newEditorOpen, setNewEditorOpen] = useState(false);
  const [bottomTerminalOpen, setBottomTerminalOpen] = useState(false);
  const [bottomTerminalCwd, setBottomTerminalCwd] = useState<string | null>(
    null,
  );
  const [apiKeys, setApiKeys] = useState<ProviderKeys>(EMPTY_PROVIDER_KEYS);

  const initPrefs = usePreferencesStore((s) => s.init);
  const prefsHydrated = usePreferencesStore((s) => s.hydrated);
  const remoteAccessEnabled = usePreferencesStore((s) => s.remoteAccessEnabled);
  useAppRuntimeBootstrap({
    onHomeChange: setHome,
    onLaunchCwdChange: setLaunchCwd,
    onLaunchCwdResolved: setLaunchCwdResolved,
    onApiKeysChange: setApiKeys,
    initPrefs,
    prefsHydrated,
    remoteAccessEnabled,
  });
  const {
    activeTab,
    activeWorkspace,
    activeWorkspaceId,
    activeWorkspaceFolder,
    isTerminalTab,
    isEditorTab,
    isPreviewTab,
    isMarkdownTab,
    isAiDiffTab,
    isGitDiffTab,
    isGitHistoryTab,
    isArchitectureTab,
  } = useAppActiveContext({ tabs, workspaces, activeId });
  const agentCommands = useAgentCliCommands();
  const respondingLeaves = useAgentResponseLeaves();
  const requestedLeaves = useAgentResponseRequestedLeaves();
  const blockedLeaves = useAgentBlockedLeaves();
  const completedLeaves = useAgentCompletedLeaves();
  const {
    activeWorkspaceCodingAgentCount,
    activeWorkspaceTerminals,
  } = useAppWorkspaceTerminalView({
    activeTab,
    activeLeafId,
    agentCommands,
    respondingLeaves,
    requestedLeaves,
    blockedLeaves,
    completedLeaves,
    closePaneByLeaf,
  });
  const activeWorkspaceAccentColor = activeWorkspace?.accentColor ?? "#0088ff";
  const pendingDeleteWorkspace =
    pendingDeleteWorkspaceId === null
      ? null
      : (workspaces.find(
          (workspace) => workspace.id === pendingDeleteWorkspaceId,
        ) ?? null);
  const workspaceItems = useAppWorkspaceItems({
    workspaces,
    tabs,
    activeId,
    activeWorkspaceId,
    activeWorkspaceTerminals,
    persistedWorkspacePanes,
    agentCommands,
    respondingLeaves,
    requestedLeaves,
    blockedLeaves,
    completedLeaves,
    activeCanvasTerminalIds: activeCanvasTerminalIds.current,
    canvasTerminalSelectionVersion,
    canvasTerminalRefs,
    closeTabActionRef,
    closePaneByLeaf,
    canvasTerminalRefKey,
  });
  const handleAgentNativeSessionId = useAppAgentSessionIdentity({
    workspacesRef,
    setWorkspaces,
    updateTab,
  });

  const { explorerRoot, inheritedCwdForNewTab } = useWorkspaceCwd(
    activeTab,
    tabs,
    launchCwd ?? home,
  );
  const workspaceSetupFolder = explorerRoot ?? launchCwd ?? home;

  const { handleSearchReady } = useAppSearchRegistry({
    activeId,
    activeLeafId,
    searchAddons,
    setActiveSearchAddon,
  });

  const clearWorkspaceTabOwnership = useCallback((tabId: number) => {
    setWorkspaces((current) => clearTabOwnership(current, tabId));
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
  useLiveTerminalCleanup({
    tabs,
    liveLeavesRef,
    terminalRefs,
    searchAddons,
  });
  const switchWorkspace = useWorkspaceEnvironmentSwitch({
    workspaceEnv,
    tabsRef,
    liveLeavesRef,
    searchAddons,
    terminalRefs,
    editorRefs,
    previewRefs,
    setActiveSearchAddon,
    setActiveEditorHandle,
    setWorkspaceEnv,
    setHome,
    setLaunchCwd,
    setWorkspaces,
    resetWorkspace,
  });
  const { handleClose, confirmClose, cancelClose } = useAppTabClose({
    tabs,
    disposeTab,
    pendingCloseTab,
    setPendingCloseTab,
  });
  closeTabActionRef.current = handleClose;

  const { toggleBottomTerminal } = useBottomTerminalController({
    activeId,
    activeWorkspaceFolder,
    tabs,
    explorerRoot,
    launchCwd,
    home,
    bottomTerminalOpen,
    bottomTerminalRef,
    setBottomTerminalOpen,
    setBottomTerminalCwd,
  });

  const {
    cycleTab,
    openNewTab,
    openNewPrivateTab,
    cdInNewTab,
  } = useAppTabNavigation({
    tabs,
    tabsRef,
    activeId,
    setActiveId,
    newTab,
    newPrivateTab,
    inheritedCwdForNewTab,
    terminalRefs,
  });
  const openShortcuts = useCallback(() => {
    setShortcutsOpen(true);
  }, []);

  const openTopMusicTab = useMusicTabAction({
    newTab,
    inheritedCwdForNewTab,
  });


  const {
    handleOpenWorkspaceWithoutAi,
    handleWorkspaceSetupCancel,
  } = useWorkspaceSetupActions({
    createWorkspace,
    inheritedCwdForNewTab,
    tabsRef,
    newAgentChatTab,
    newWorkspaceTab,
    newArchitectureTab,
    closeTab,
    setActiveId,
    setWorkspaceSetupOpen,
    workspacesHydrated,
    workspacesLength: workspaces.length,
    setWorkspaceForkContext,
  });

  const { handleForkAgentResponse } = useWorkspaceForkActions({
    workspacesRef,
    setWorkspaces,
    newAgentChatTab,
    saveRecentWorkspace,
    setWorkspaceForkContext,
    setWorkspaceSetupOpen,
  });
  const {
    handleSelectWorkspace,
    openingWorkspaceId,
    initialActivationHandled,
    pendingBootstrapCloseRef,
  } = useWorkspaceSelectionController({
    workspaces,
    tabs,
    activeWorkspaceId,
    workspacesHydrated,
    setWorkspaces,
    closeWorkspaceSetup: () => setWorkspaceSetupOpen(false),
    saveRecentWorkspace,
    activateTab: setActiveId,
    updateTab: (tabId, patch) => updateTab(tabId, patch),
    persistCanvasDiagram: (tabId, diagram) => {
      persistCanvasDiagramRef.current?.(tabId, diagram);
    },
    createCanvasTab: newArchitectureTab,
    createAgentChatTab: newAgentChatTab,
    createWorkspaceTab: newWorkspaceTab,
    syncWorkspacePaneNativeSessions,
    buildCanvasWorkspaceDiagram,
  });

  const initialWorkspaceActivationHandledRef = {
    current: initialActivationHandled,
  };

  const deleteWorkspace = useWorkspaceDeletion({
    workspacesRef,
    tabsRef,
    removeWorkspace,
    disposeTab,
    resetWorkspace,
    fallbackCwd: launchCwd ?? home ?? undefined,
  });

  const {
    handleCloseWorkspace,
    confirmDeleteWorkspace,
    cancelDeleteWorkspace,
  } = useWorkspaceDeleteConfirmation({
    workspacesRef,
    skipConfirmation: skipWorkspaceDeleteConfirm,
    deleteWorkspace,
    pendingWorkspaceId: pendingDeleteWorkspaceId,
    doNotAskAgain: workspaceDeleteDoNotAskAgain,
    setPendingWorkspaceId: setPendingDeleteWorkspaceId,
    setDoNotAskAgain: setWorkspaceDeleteDoNotAskAgain,
    setSkipConfirmation: setSkipWorkspaceDeleteConfirm,
  });

  const handleRenameWorkspace = useCallback(
    (workspaceId: string, name: string) => renameWorkspace(workspaceId, name),
    [renameWorkspace],
  );
  const handleChangeWorkspaceColor = useCallback(
    (workspaceId: string, color: string) => changeWorkspaceColor(workspaceId, color),
    [changeWorkspaceColor],
  );
  const handleReorderWorkspaces = useCallback(
    (draggedId: string, targetId: string, position: "before" | "after") =>
      reorderWorkspaces(draggedId, targetId, position),
    [reorderWorkspaces],
  );

  const cycleWorkspace = useCallback(
    (delta: 1 | -1) => {
      const index = workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId);
      const nextIndex = nextWorkspaceIndex(workspaces.length, index, delta);
      if (nextIndex !== null) handleSelectWorkspace(workspaces[nextIndex].id);
    },
    [activeWorkspaceId, handleSelectWorkspace, workspaces],
  );

  useBootstrapTabCleanup({
    activeWorkspaceId,
    tabs,
    pendingBootstrapCloseRef,
    closeTab,
  });

  const focusDirectionalPane = useDirectionalPaneFocus({
    activeLeafId,
    activeTab,
    focusPane,
  });

  const {
    handleOpenFile,
    handlePathRenamed,
    handlePathDeleted,
  } = useAppFileActions({
    tabs,
    openFileTab,
    updateTab,
    disposeTab,
    setPendingDeleteTabs,
  });

  const confirmDeleteClose = useCallback(() => {
    if (pendingDeleteTabs !== null) {
      for (const id of pendingDeleteTabs) disposeTab(id);
      setPendingDeleteTabs(null);
    }
  }, [pendingDeleteTabs, disposeTab]);

  const cancelDeleteClose = useCallback(() => {
    setPendingDeleteTabs(null);
  }, []);

  const activeTerminalLeafCwd = resolveActiveTerminalLeafCwd(activeTab);

  const activeFilePath = resolveActiveFilePath(activeTab);
  const workspaceFallbackPath = launchCwdResolved
    ? (launchCwd ?? home ?? null)
    : null;
  // Stable per-session path so switching tabs / cd-ing in a shell does NOT
  // re-fire git IPC for the header git controls unless a git tab is open.
  const {
    sourceControlContextPath,
    sourceControlPath,
  } = useAppSourceControlContext({
    activeTab,
    activeTerminalLeafCwd,
    explorerRoot,
    workspaceFallbackPath,
    tabs,
    sidebarView,
    editorSidebarView,
  });
  const sourceControl = useSourceControl(sourceControlPath, true);

  const { toggleSourceControl, openGitGraphFromContext } =
    useAppSourceControlActions({
      sourceControl,
      sourceControlContextPath,
      setEditorSidebarView,
      cycleSidebarView,
      openCommitHistoryTab,
    });


  const openPreviewTab = usePreviewTabAction({
    newPreviewTab,
    previewRefs,
  });

  const openMarkdownPreview = useCallback(
    (path: string) => {
      newMarkdownTab(path);
    },
    [newMarkdownTab],
  );

  const persistSplitPaneTree = useSplitPanePersistence({
    workspacesRef,
    setWorkspaces,
    persistWorkspace: (workspace) => {
      void invoke("db_save_workspace", { workspace });
    },
    persistPaneRecord,
    persistedPaneFor,
    buildPaneRecord: buildWorkspacePaneRecord,
  });

  const {
    splitActivePaneInActiveTab,
    handleCloseTabOrPane,
    maximizeActivePane,
  } = useAppPaneActions({
    activeId,
    activeTerminalTab,
    tabsRef,
    splitActivePane,
    persistSplitPaneTree,
    closeActivePane,
    handleClose,
    toggleMaximizePane,
  });

  const {
    onCanvasTerminalHandleChange,
    onActiveCanvasTerminalChange,
  } = useCanvasTerminalHandleRegistry({
    canvasTerminalRefs,
    activeCanvasTerminalIds,
    setSelectionVersion: setCanvasTerminalSelectionVersion,
    refKey: canvasTerminalRefKey,
  });

  const {
    captureVoiceTarget,
    captureVoiceVocabulary,
    insertVoiceDraft,
  } = useAppVoiceIntegration({
    activeId,
    activeWorkspaceFolder,
    tabsRef,
    terminalRefs,
    canvasTerminalRefs,
    activeCanvasTerminalIds,
    pendingVoiceDraftsRef,
    canvasTerminalRefKey,
  });

  const toggleVoiceAgent = useCallback(() => {
    voiceAgentRef.current?.toggle();
  }, []);

  useAppWindowEvents({
    onNewTab: openNewTab,
    onOpenShortcuts: openShortcuts,
    onMaximizePane: maximizeActivePane,
  });

  const shortcutHandlers = useMemo(
    () =>
      createAppShortcutHandlers({
        activeTabKind: activeTab?.kind,
        hasGitRepository: sourceControl.hasRepo,
        openNewTab,
        openNewPrivateTab,
        openPreviewTab: () => openPreviewTab(""),
        openEditor: () => setNewEditorOpen(true),
        openGitGraph: () => void openGitGraphFromContext(),
        openArchitecture: () => newArchitectureTab(),
        closeTabOrPane: handleCloseTabOrPane,
        cycleTab,
        selectTabByIndex: selectByIndex,
        splitPane: splitActivePaneInActiveTab,
        focusNextPane: (delta) => focusNextPaneInTab(activeId, delta),
        maximizePane: maximizeActivePane,
        closeActivePane: () => closeActivePane(activeId),
        toggleSourceControl,
        focusSearch: () => searchInlineRef.current?.focus(),
        toggleBottomTerminal,
        openMusic: openTopMusicTab,
        toggleVoice: toggleVoiceAgent,
        toggleShortcuts: () => setShortcutsOpen((value) => !value),
        openSettings: () => void openSettingsWindow(),
        toggleSidebar,
        toggleExplorerFocus,
        zoomIn,
        zoomOut,
        zoomReset,
        undo: () => editorRefs.current.get(activeId)?.undo(),
        redo: () => editorRefs.current.get(activeId)?.redo(),
        cycleWorkspace,
        focusDirectionalPane,
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

  const shortcutsDisabled = useMemo(
    () =>
      createAppShortcutDisabled({
        activeTabKind: activeTab?.kind,
        hasGitRepository: sourceControl.hasRepo,
        isExplorerFocused: () => Boolean(explorerRef.current?.isFocused()),
        architectureActive: activeTab?.kind === "architecture",
      }),
    [activeTab?.kind, sourceControl.hasRepo],
  );

  useGlobalShortcuts(shortcutHandlers, { isDisabled: shortcutsDisabled });

  const {
    registerTerminalHandle,
    registerEditorHandle,
    registerPreviewHandle,
  } = useAppHandleRegistry({
    activeId,
    terminalRefs,
    editorRefs,
    previewRefs,
    setActiveEditorHandle,
  });

  const handlePreviewUrl = useCallback(
    (id: number, url: string) => updateTab(id, { url }),
    [updateTab],
  );

  const {
    handleTerminalCwd,
    changeTerminalDirectory,
    handleSwitchTerminalAgent,
    handleTerminalCommand,
  } = useTerminalWorkspaceActions({
    activeLeafId,
    activeWorkspaceId,
    tabsRef,
    workspacesRef,
    terminalRefs,
    pendingVoiceDraftsRef,
    workspacePaneLaunchAtRef,
    setLeafCwd,
    setLeafLaunchCommand,
    persistPaneRecord,
    persistedPaneFor,
    buildPaneRecord: buildWorkspacePaneRecord,
    scheduleWorkspacePaneSessionSync,
    respawnSession,
    replaceSessionCommand,
  });



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
              buildWorkspacePaneRecord(
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

  const {
    swapWorkspaceTerminals: handleSwapWorkspaceTerminals,
    focusLeaf: handleFocusLeaf,
    handleLeafExit,
  } = useTerminalPaneActions({
    tabsRef,
    focusPane,
    handlePaneTreeChange: handleTerminalPaneTreeChange,
    closePaneByLeaf,
    clearWorkspaceTabOwnership,
    respawnSession,
  });


  const { handleSelectWorkspaceTerminal } = useWorkspaceTerminalSelection({
    activeCanvasTerminalIds,
    pendingWorkspaceTerminalRef,
    tabsRef,
    workspacesRef,
    tabs,
    workspaces,
    setActiveId,
    setCanvasTerminalSelectionVersion,
    focusPane,
    handleSelectWorkspace,
  });

  const handleCreateWorkspaceTerminal = useWorkspaceTerminalCreationAction({
    workspaceId: activeWorkspaceId,
    tabsRef,
    canvasTerminalCreators: canvasTerminalCreatorRef,
    appendTerminalPane,
    newAgentChatTab,
    setActiveId,
    persistPaneRecord,
    persistedPaneFor,
    buildPaneRecord: buildWorkspacePaneRecord,
    saveRecentWorkspace,
    scheduleWorkspacePaneSessionSync,
    createWorkspaceTerminal,
  });

  const handleEditorDirty = useCallback(
    (id: number, dirty: boolean) => updateTab(id, { dirty }),
    [updateTab],
  );

  const searchTarget = useAppSearchTarget({
    isTerminalTab,
    isEditorTab,
    isGitHistoryTab,
    activeLeafId,
    activeSearchAddon,
    activeEditorHandle,
    gitHistoryHandle,
    terminalRefs: terminalRefs.current,
  });

  const activeCwd = activeTerminalLeafCwd;

  const handleImportAgentSession = useWorkspaceSessionImportAction({
    workspaceId: activeWorkspaceId,
    tabsRef,
    appendTerminalPane,
    updateCanvasDiagram: handleArchitectureDiagramChange,
    setActiveId,
    persistPaneRecord,
    persistedPaneFor,
    buildPaneRecord: buildWorkspacePaneRecord,
    saveRecentWorkspace,
    scheduleWorkspacePaneSessionSync,
    importAgentSession,
  });

  const {
    hideBootstrapShell,
    showWorkspaceSwitchLoading,
    workspaceLoadingLabel,
  } = getAppStartupView({
    activeTabId: activeTab?.id ?? null,
    activeWorkspaceId,
    workspacesHydrated,
    initialWorkspaceActivationHandled:
      initialWorkspaceActivationHandledRef.current,
    pendingBootstrapClose: pendingBootstrapCloseRef.current,
    openingWorkspaceId,
    workspaces,
  });
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
    <WorkspaceSurface
      tabs={tabs}
      activeId={activeId}
      hideBootstrapShell={hideBootstrapShell}
      isTerminalTab={isTerminalTab}
      isEditorTab={isEditorTab}
      isPreviewTab={isPreviewTab}
      isMarkdownTab={isMarkdownTab}
      isAiDiffTab={isAiDiffTab}
      isGitDiffTab={isGitDiffTab}
      isGitHistoryTab={isGitHistoryTab}
      isArchitectureTab={isArchitectureTab}
      canvasFocused={canvasFocused}
      activeWorkspaceAccentColor={activeWorkspaceAccentColor}
      workspaces={workspaces}
      apiKeys={apiKeys}
      terminalProps={{
        registerHandle: registerTerminalHandle,
        onSearchReady: handleSearchReady,
        onCwd: handleTerminalCwd,
        onChangeDirectory: changeTerminalDirectory,
        onExit: handleLeafExit,
        onCommand: handleTerminalCommand,
        onSwitchAgent: handleSwitchTerminalAgent,
        onFocusLeaf: handleFocusLeaf,
        onCloseLeaf: closePaneByLeaf,
        onToggleMaximize: toggleMaximizePane,
        onSplitPane: splitActivePaneInActiveTab,
        onPaneTreeChange: handleTerminalPaneTreeChange,
      }}
      onAgentForkResponse={(workspaceId, provider, cwd, destination, attachment) =>
        handleForkAgentResponse({
          workspaceId,
          provider,
          cwd,
          destination: destination as "tab" | "workspace",
          attachment,
        })
      }
      onAgentNativeSessionId={handleAgentNativeSessionId}
      onOpenFileDiff={openGitDiffTab}
      onDiagramChange={handleArchitectureDiagramChange}
      onRegisterTerminalCreator={(tabId, creator) => {
        if (creator) canvasTerminalCreatorRef.current.set(tabId, creator);
        else canvasTerminalCreatorRef.current.delete(tabId);
      }}
      onTerminalHandleChange={onCanvasTerminalHandleChange}
      onActiveTerminalChange={onActiveCanvasTerminalChange}
      onToggleCanvasFocus={toggleCanvasFocus}
      registerEditorHandle={registerEditorHandle}
      onEditorDirty={handleEditorDirty}
      onCloseEditorTab={disposeTab}
      registerPreviewHandle={registerPreviewHandle}
      onPreviewUrlChange={handlePreviewUrl}
      onOpenCommitFile={openCommitFileDiffTab}
      onGitHistorySearchHandle={setGitHistoryHandle}
    />
  );

  const workspacesPanel = (
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
  );

  const workspaceSetup = workspaceSetupOpen ? (
    <div className="absolute inset-0 z-30 bg-background">
      <WorkspaceSetupView
        workingFolder={workspaceForkContext?.cwd ?? workspaceSetupFolder}
        suggestedWorkspaceName={nextWorkspaceName(workspaces) ?? "workspace"}
        suggestedWorkspaceColor={workspaceAccentForIndex(workspaces.length)}
        recentWorkspaces={recentWorkspaces}
        forkContext={workspaceForkContext}
        onCancel={handleWorkspaceSetupCancel}
        onOpenWithoutAi={handleOpenWorkspaceWithoutAi}
      />
    </div>
  ) : null;

  const workspaceLoading = showWorkspaceSwitchLoading && !workspaceSetupOpen ? (
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
  ) : null;

  const bottomTerminal = bottomTerminalOpen ? (
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
  ) : null;

  const sidebar = (
    <AppSidebar
      sidebarView={sidebarView}
      editorSidebarView={editorSidebarView}
      sidebarRail={{ placement: "top", onSelectView: persistSidebarView }}
      editorRail={{ onSelectView: setEditorSidebarView }}
      browser={{
        url: sidebarBrowserUrl,
        visible: sidebarView === "browser",
        resizing: sidebarResizing,
        onUrlChange: persistSidebarBrowserUrl,
      }}
      explorer={{
        ref: explorerRef,
        rootPath: explorerRoot,
        acceptExternalDrops: isEditorTab,
        onOpenFile: handleOpenFile,
        onPathRenamed: handlePathRenamed,
        onPathDeleted: handlePathDeleted,
        onRevealInTerminal: cdInNewTab,
        onOpenMarkdownPreview: openMarkdownPreview,
      }}
      sourceControl={{
        open: sidebarView === "editor" && editorSidebarView === "source-control",
        sourceControl,
        onOpenGitGraph: openGitGraphFromContext,
        onOpenDiff: openGitDiffTab,
      }}
    />
  );

  const shell = (
    <AppShell mainShellRef={mainShellRef}>
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

          <AppChrome
            sidebarSplitRef={sidebarSplitRef}
            workspaceRef={workspaceRef}
            workspacesPanel={workspacesPanel}
            workspaceSurface={workspaceSurface}
            workspaceSetup={workspaceSetup}
            workspaceLoading={workspaceLoading}
            bottomTerminal={bottomTerminal}
            sidebar={sidebar}
            sidebarOpen={sidebarOpen}
            sidebarWidth={sidebarWidth}
            sidebarResizing={sidebarResizing}
            workspacesPanelOpen={workspacesPanelOpen}
            workspacesPanelWidth={workspacesPanelWidth}
            workspacesPanelCompact={workspacesPanelCompact}
            workspacesPanelResizing={workspacesPanelResizing}
            workspaceSetupOpen={workspaceSetupOpen}
            onWorkspacesPanelResizeStart={handleWorkspacesPanelResizeStart}
            onWorkspacesPanelResizeKeyDown={handleWorkspacesPanelResizeKeyDown}
            onSidebarResizeStart={handleSidebarResizeStart}
            onSidebarResizeKeyDown={handleSidebarResizeKeyDown}
          />
          <AppOverlays
            importSessionOpen={importSessionOpen}
            setImportSessionOpen={setImportSessionOpen}
            activeWorkspace={activeWorkspace ?? null}
            activeWorkspaceFolder={activeWorkspaceFolder}
            handleImportAgentSession={handleImportAgentSession}
            activeCwd={activeCwd}
            activeFilePath={activeFilePath}
            home={home}
            changeTerminalDirectory={changeTerminalDirectory}
            switchWorkspace={switchWorkspace}
            toggleBottomTerminal={toggleBottomTerminal}
            activeTab={activeTab}
            voiceAgentRef={voiceAgentRef}
            captureVoiceTarget={captureVoiceTarget}
            captureVoiceVocabulary={captureVoiceVocabulary}
            apiKeys={apiKeys}
            insertVoiceDraft={insertVoiceDraft}
            shortcutsOpen={shortcutsOpen}
            setShortcutsOpen={setShortcutsOpen}
            newEditorOpen={newEditorOpen}
            setNewEditorOpen={setNewEditorOpen}
            explorerRoot={explorerRoot}
            openFileTab={openFileTab}
            tabs={tabs}
            pendingCloseTab={pendingCloseTab}
            pendingDeleteTabs={pendingDeleteTabs}
            cancelClose={cancelClose}
            confirmClose={confirmClose}
            cancelDeleteClose={cancelDeleteClose}
            confirmDeleteClose={confirmDeleteClose}
            pendingDeleteWorkspaceId={pendingDeleteWorkspaceId}
            pendingDeleteWorkspace={pendingDeleteWorkspace}
            workspaceDeleteDoNotAskAgain={workspaceDeleteDoNotAskAgain}
            setWorkspaceDeleteDoNotAskAgain={setWorkspaceDeleteDoNotAskAgain}
            cancelDeleteWorkspace={cancelDeleteWorkspace}
            confirmDeleteWorkspace={confirmDeleteWorkspace}
          />
    </AppShell>
  );

  return shell;
}
