import type { ShortcutHandlers, ShortcutId } from "@/modules/shortcuts";

export type AppShortcutCoordination = {
  activeTabKind: string | undefined;
  hasGitRepository: boolean;
  openNewTab: () => void;
  openNewPrivateTab: () => void;
  openPreviewTab: () => void;
  openEditor: () => void;
  openGitGraph: () => void;
  openArchitecture: () => void;
  closeTabOrPane: () => void;
  cycleTab: (delta: 1 | -1) => void;
  selectTabByIndex: (index: number) => void;
  splitPane: (direction: "row" | "col") => void;
  focusNextPane: (delta: 1 | -1) => void;
  maximizePane: () => void;
  closeActivePane: () => void;
  toggleSourceControl: () => void;
  focusSearch: () => void;
  toggleBottomTerminal: () => void;
  openMusic: () => void;
  toggleVoice: () => void;
  toggleShortcuts: () => void;
  openSettings: () => void;
  toggleSidebar: () => void;
  toggleExplorerFocus: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  undo: () => void;
  redo: () => void;
  cycleWorkspace: (delta: 1 | -1) => void;
  focusDirectionalPane: (direction: "left" | "right" | "up" | "down") => void;
};

export function createAppShortcutHandlers(
  actions: AppShortcutCoordination,
): ShortcutHandlers {
  return {
    "tab.new": actions.openNewTab,
    "tab.newPrivate": actions.openNewPrivateTab,
    "tab.newPreview": actions.openPreviewTab,
    "tab.newEditor": actions.openEditor,
    "tab.newGitGraph": () => {
      if (actions.hasGitRepository) actions.openGitGraph();
    },
    "tab.newArchitecture": actions.openArchitecture,
    "tab.close": actions.closeTabOrPane,
    "tab.next": () => actions.cycleTab(1),
    "tab.prev": () => actions.cycleTab(-1),
    "tab.selectByIndex": (event) =>
      actions.selectTabByIndex(Number.parseInt(event.key, 10) - 1),
    "pane.splitRight": () => actions.splitPane("row"),
    "pane.splitDown": () => actions.splitPane("col"),
    "pane.focusNext": () => actions.focusNextPane(1),
    "pane.focusPrev": () => actions.focusNextPane(-1),
    "pane.maximize": actions.maximizePane,
    "pane.close": () => {
      if (actions.activeTabKind === "terminal") actions.closeActivePane();
    },
    "pane.source": actions.toggleSourceControl,
    "search.focus": actions.focusSearch,
    "terminal.bottom": actions.toggleBottomTerminal,
    "music.open": actions.openMusic,
    "voice.toggle": actions.toggleVoice,
    "shortcuts.open": actions.toggleShortcuts,
    "settings.open": actions.openSettings,
    "sidebar.toggle": actions.toggleSidebar,
    "explorer.focus": actions.toggleExplorerFocus,
    "view.zoomIn": actions.zoomIn,
    "view.zoomOut": actions.zoomOut,
    "view.zoomReset": actions.zoomReset,
    "editor.undo": actions.undo,
    "editor.redo": actions.redo,
    "workspace.next": () => actions.cycleWorkspace(1),
    "workspace.prev": () => actions.cycleWorkspace(-1),
    "pane.focusLeft": () => actions.focusDirectionalPane("left"),
    "pane.focusRight": () => actions.focusDirectionalPane("right"),
    "pane.focusUp": () => actions.focusDirectionalPane("up"),
    "pane.focusDown": () => actions.focusDirectionalPane("down"),
  };
}

export function createAppShortcutDisabled({
  activeTabKind,
  hasGitRepository,
  isExplorerFocused,
  architectureActive,
}: {
  activeTabKind: string | undefined;
  hasGitRepository: boolean;
  isExplorerFocused: () => boolean;
  architectureActive: boolean;
}): (id: ShortcutId, _event: KeyboardEvent) => boolean {
  return (id) => {
    if (id === "editor.undo" || id === "editor.redo") {
      if (isExplorerFocused()) return true;
      return activeTabKind !== "editor";
    }
    if (id === "pane.close") return activeTabKind !== "terminal";
    if (id === "tab.newGitGraph") return !hasGitRepository;
    if (
      architectureActive &&
      (id === "pane.focusLeft" ||
        id === "pane.focusRight" ||
        id === "pane.focusUp" ||
        id === "pane.focusDown" ||
        id === "pane.maximize")
    ) {
      return true;
    }
    return false;
  };
}
