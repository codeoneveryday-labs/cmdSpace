import type { Tab, TerminalTab } from "@/modules/tabs";
import type { SearchAddon } from "@xterm/addon-search";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PaneTreeView, type PaneDragContext } from "./PaneTreeView";
import type { TerminalPaneHandle } from "./TerminalPane";
import {
  findLeafCwd,
  findLeafAutoLaunch,
  findLeafLastCommand,
  leafIds,
  swapLeafNodes,
  type PaneNode,
  type SplitDir,
} from "./lib/panes";
import { usePaneBundles } from "./lib/usePaneBundles";
import { usePaneHydration } from "./lib/usePaneHydration";
import { useTerminalCollaboration } from "./lib/useTerminalCollaboration";

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
  const nodeToRender = useMemo(() => {
    if (!activeTerminal) return null;
    const maximizedLeafId = activeTerminal.maximizedLeafId;
    if (maximizedLeafId === undefined) return activeTerminal.paneTree;
    return {
      kind: "leaf" as const,
      id: maximizedLeafId,
      cwd: findLeafCwd(activeTerminal.paneTree, maximizedLeafId),
      lastCommand: findLeafLastCommand(
        activeTerminal.paneTree,
        maximizedLeafId,
      ),
      autoLaunch: findLeafAutoLaunch(
        activeTerminal.paneTree,
        maximizedLeafId,
      ),
    };
  }, [activeTerminal]);
  const renderLeafIds = useMemo(
    () => (nodeToRender ? leafIds(nodeToRender) : []),
    [nodeToRender],
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
  const [dragState, setDragState] = useState<{
    tabId: number;
    sourceId: number;
    targetId: number | null;
    targetOffset: { x: number; y: number } | null;
  } | null>(null);
  const { stateForTab, toggleBroadcast, toggleBroadcastTarget } =
    useTerminalCollaboration(terminals);
  const activeBroadcast = stateForTab(activeTerminal);
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const finishPaneDrag = useCallback(
    (commit: boolean, targetOverride?: number | null) => {
      const activeDrag = dragStateRef.current;
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      setDragState(null);
      if (!commit || !activeDrag) return;

      const tab = terminals.find((candidate) => candidate.id === activeDrag.tabId);
      const targetId =
        targetOverride === undefined ? activeDrag.targetId : targetOverride;
      if (targetId === null || !tab || targetId === activeDrag.sourceId) return;

      const nextTree = swapLeafNodes(tab.paneTree, activeDrag.sourceId, targetId);
      if (nextTree === tab.paneTree) return;
      onPaneTreeChange(tab.id, nextTree);
      onFocusLeaf(tab.id, activeDrag.sourceId);
    },
    [onFocusLeaf, onPaneTreeChange, terminals],
  );

  const startPaneDrag = useCallback(
    (sourceId: number, event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        event.button !== 0 ||
        (event.target instanceof Element && event.target.closest("button"))
      ) {
        return;
      }
      const tab = activeTerminal;
      if (!tab || leafIds(tab.paneTree).length < 2) return;

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      finishPaneDrag(false);

      const pointerId = event.pointerId;
      const ownerDocument = event.currentTarget.ownerDocument;
      const ownerWindow = ownerDocument.defaultView ?? window;
      const updateTarget = (point: { clientX: number; clientY: number }) => {
        const hit = ownerDocument
          .elementsFromPoint(point.clientX, point.clientY)
          .map((element) => element.closest<HTMLElement>("[data-pane-leaf]"))
          .find((element): element is HTMLElement => element !== null);
        const candidateId = hit ? Number(hit.dataset.paneLeaf) : null;
        const targetId =
          candidateId !== null && leafIds(tab.paneTree).includes(candidateId)
            ? candidateId
            : null;
        const normalizedTargetId = targetId === sourceId ? null : targetId;
        const source = ownerDocument.querySelector<HTMLElement>(
          `[data-pane-leaf="${sourceId}"]`,
        );
        const targetOffset =
          normalizedTargetId !== null && source && hit
            ? paneSwapPreviewOffset(
                source.getBoundingClientRect(),
                hit.getBoundingClientRect(),
              )
            : null;
        setDragState((current) =>
          current && current.targetId === normalizedTargetId
            ? current
            : current
              ? { ...current, targetId: normalizedTargetId, targetOffset }
              : current,
        );
        return normalizedTargetId;
      };
      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        moveEvent.preventDefault();
        updateTarget(moveEvent);
      };
      const handlePointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        const targetId = updateTarget(upEvent);
        finishPaneDrag(true, targetId);
      };
      const handleKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== "Escape") return;
        keyEvent.preventDefault();
        finishPaneDrag(false);
      };
      const cancel = () => finishPaneDrag(false);

      ownerDocument.addEventListener("pointermove", handlePointerMove);
      ownerDocument.addEventListener("pointerup", handlePointerUp);
      ownerDocument.addEventListener("pointercancel", cancel);
      ownerDocument.addEventListener("keydown", handleKeyDown);
      ownerWindow.addEventListener("blur", cancel);
      dragCleanupRef.current = () => {
        ownerDocument.removeEventListener("pointermove", handlePointerMove);
        ownerDocument.removeEventListener("pointerup", handlePointerUp);
        ownerDocument.removeEventListener("pointercancel", cancel);
        ownerDocument.removeEventListener("keydown", handleKeyDown);
        ownerWindow.removeEventListener("blur", cancel);
      };
      setDragState({
        tabId: tab.id,
        sourceId,
        targetId: null,
        targetOffset: null,
      });
    },
    [activeTerminal, finishPaneDrag],
  );

  useEffect(() => () => dragCleanupRef.current?.(), []);

  const paneDragContext: PaneDragContext = {
    draggingId: dragState?.sourceId ?? null,
    targetId: dragState?.targetId ?? null,
    targetOffset: dragState?.targetOffset ?? null,
    onDragStart: startPaneDrag,
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {activeTerminal && nodeToRender ? (
        <div key={activeTerminal.id} className="absolute inset-0">
          <PaneTreeView
            node={nodeToRender}
            tabVisible={true}
            activeLeafId={activeTerminal.activeLeafId}
            onFocusLeaf={(leafId) => onFocusLeaf(activeTerminal.id, leafId)}
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

function paneSwapPreviewOffset(source: DOMRect, target: DOMRect) {
  const towardSource = (sourceCenter: number, targetCenter: number) =>
    Math.max(-12, Math.min(12, Math.sign(sourceCenter - targetCenter) * 10));

  return {
    x: towardSource(source.left + source.width / 2, target.left + target.width / 2),
    y: towardSource(source.top + source.height / 2, target.top + target.height / 2),
  };
}
