import type { Tab, TerminalTab } from "@/modules/tabs";
import type { SearchAddon } from "@xterm/addon-search";
import { useMemo } from "react";
import { PaneTreeView } from "./PaneTreeView";
import type { TerminalPaneHandle } from "./TerminalPane";
import {
  leafIds,
  type PaneNode,
  type SplitDir,
} from "./lib/panes";
import { usePaneBundles } from "./lib/usePaneBundles";
import { usePaneHydration } from "./lib/usePaneHydration";
import { useTerminalCollaboration } from "./lib/useTerminalCollaboration";
import { useTerminalPaneDrag } from "./lib/useTerminalPaneDrag";
import { getTerminalPaneRenderState } from "./lib/terminalPaneRenderModel";

type Props = {
  tabs: Tab[];
  activeId: number;
  /** Register/unregister handle by leaf id (not tab id). */
  registerHandle: (leafId: number, handle: TerminalPaneHandle | null) => void;
  onSearchReady: (leafId: number, addon: SearchAddon) => void;
  onCwd: (leafId: number, cwd: string) => void;
  onChangeDirectory: (path: string) => void;
  onExit: (leafId: number, code: number) => void;
  onCommand?: (leafId: number, cmd: string) => void;
  onSwitchAgent: (leafId: number, command: string | null) => void;
  onFocusLeaf: (tabId: number, leafId: number) => void;
  onCloseLeaf: (leafId: number) => void;
  onToggleMaximize: (leafId: number) => void;
  onSplitPane: (dir: SplitDir) => void;
  focusAccentColor: string;
  onPaneTreeChange: (tabId: number, paneTree: PaneNode) => void;
};

export function TerminalStack({
  tabs,
  activeId,
  registerHandle,
  onSearchReady,
  onCwd,
  onChangeDirectory,
  onExit,
  onCommand,
  onSwitchAgent,
  onFocusLeaf,
  onCloseLeaf,
  onToggleMaximize,
  onSplitPane,
  focusAccentColor,
  onPaneTreeChange,
}: Props) {
  const terminals = useMemo(
    () => tabs.filter((t) => t.kind === "terminal") as TerminalTab[],
    [tabs],
  );
  const activeTerminal = terminals.find((t) => t.id === activeId) ?? null;
  const { node: nodeToRender, leafIds: renderLeafIds } = useMemo(
    () => getTerminalPaneRenderState(activeTerminal),
    [activeTerminal],
  );
  const { getBundle } = usePaneBundles({
    terminals,
    registerHandle,
    onSearchReady,
    onCwd,
    onExit,
    onCommand,
  });
  const { hydrateLeaf, isLeafHydrated } = usePaneHydration({
    activeLeafId: activeTerminal?.activeLeafId ?? null,
    renderLeafIds,
    scopeKey: activeTerminal?.id ?? null,
  });
  const { stateForTab, toggleBroadcast, toggleBroadcastTarget } =
    useTerminalCollaboration(terminals);
  const activeBroadcast = stateForTab(activeTerminal);
  const paneDragContext = useTerminalPaneDrag({
    activeTerminal,
    terminals,
    onFocusLeaf,
    onPaneTreeChange,
  });

  return (
    <div className="relative h-full w-full overflow-hidden">
      {activeTerminal && nodeToRender ? (
        <div key={activeTerminal.id} className="absolute inset-0">
          <PaneTreeView
            node={nodeToRender}
            tabVisible={true}
            activeLeafId={activeTerminal.activeLeafId}
            onFocusLeaf={(leafId) => onFocusLeaf(activeTerminal.id, leafId)}
            onSwitchAgent={onSwitchAgent}
            getBundle={getBundle}
            onCloseLeaf={onCloseLeaf}
            onChangeDirectory={onChangeDirectory}
            onToggleMaximize={onToggleMaximize}
            isMaximized={activeTerminal.maximizedLeafId !== undefined}
            canMaximize={leafIds(activeTerminal.paneTree).length > 1}
            onSplitPane={onSplitPane}
            focusAccentColor={focusAccentColor}
            isLeafHydrated={isLeafHydrated}
            onHydrateLeaf={hydrateLeaf}
            onPaneTreeChange={(paneTree) =>
              onPaneTreeChange(activeTerminal.id, paneTree)
            }
            dragContext={paneDragContext}
            broadcastEnabled={activeBroadcast.enabled}
            broadcastTargetLeafIds={activeBroadcast.targetLeafIds}
            canBroadcast={leafIds(activeTerminal.paneTree).length > 1}
            onToggleBroadcast={() => toggleBroadcast(activeTerminal)}
            onToggleBroadcastTarget={(leafId) =>
              toggleBroadcastTarget(activeTerminal, leafId)
            }
          />
        </div>
      ) : null}
    </div>
  );
}
