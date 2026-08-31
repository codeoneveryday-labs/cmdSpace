import {
  Fragment,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { GroupImperativeHandle } from "react-resizable-panels";
import type { SearchAddon } from "@xterm/addon-search";
import { TerminalPane, type TerminalPaneHandle } from "./TerminalPane";
import { type PaneNode, type SplitDir } from "./lib/panes";
import {
  useAgentBlockedLeaves,
  useAgentCompletedLeaves,
  useAgentCliCommand,
  useAgentResponseLeaves,
  useAgentResponseRequestedLeaves,
} from "./lib/agentActivity";
import { detectCliAgent } from "./lib/cliAgents";
import { usePaneResizeController } from "./lib/usePaneResizeController";
import type { PaneDragContext } from "./lib/useTerminalPaneDrag";
import { FloatingTerminalOverlay } from "./FloatingTerminalOverlay";

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
  onSwitchAgent: (leafId: number, command: string | null) => void;
};

export type { PaneDragContext } from "./lib/useTerminalPaneDrag";

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
  onSwitchAgent,
}: Props) {
  const groupRef = useRef<GroupImperativeHandle | null>(null);
  const [agentResponding, setAgentResponding] = useState(false);
  const respondingLeaves = useAgentResponseLeaves();
  const requestedLeaves = useAgentResponseRequestedLeaves();
  const blockedLeaves = useAgentBlockedLeaves();
  const completedLeaves = useAgentCompletedLeaves();
  const storedAgentCommand = useAgentCliCommand(
    node.kind === "leaf" ? node.id : undefined,
  );
  const [detectedAgentCommand, setDetectedAgentCommand] = useState<string | undefined>(
    () => (node.kind === "leaf" && detectCliAgent(node.lastCommand) ? node.lastCommand : undefined),
  );
  const resizeController = usePaneResizeController({
    groupRef,
    children: node.kind === "split" ? node.children : [],
    direction: node.kind === "split" ? node.dir : "row",
    onCommit: (children) => {
      if (node.kind === "split") {
        onPaneTreeChange({ ...node, children });
      }
    },
  });
  if (node.kind === "leaf") {
    const focused = node.id === activeLeafId;
    const hydrated = isLeafHydrated(node.id);
    const b = getBundle(node.id);
    const isDragging = dragContext?.draggingId === node.id;
    const isDropTarget = dragContext?.targetId === node.id;
    const agentState = blockedLeaves.has(node.id)
      ? "blocked"
      : agentResponding || requestedLeaves.has(node.id) || respondingLeaves.has(node.id)
        ? "working"
        : completedLeaves.has(node.id)
          ? "done"
          : undefined;
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
          agentState={agentState}
          onSwitchAgent={(_agent, command) => {
            setDetectedAgentCommand(
              command && detectCliAgent(command) ? command : undefined,
            );
            onSwitchAgent(node.id, command);
          }}
          hydrated={hydrated}
          onDragStart={(event) => dragContext?.onDragStart(node.id, event)}
          isDragging={isDragging}
          broadcastEnabled={broadcastEnabled}
          broadcastTargeted={broadcastTargetLeafIds.includes(node.id)}
          canBroadcast={canBroadcast}
          onToggleBroadcast={onToggleBroadcast}
          onToggleBroadcastTarget={() => onToggleBroadcastTarget(node.id)}
        />
      </div>
    );
  }

  const splitNode = node;
  const isHorizontalGroup = splitNode.dir === "row";

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
              onPointerDown={(event) => resizeController.startPaneResize(event, i)}
              onKeyDown={(event) => resizeController.handleResizeKeyDown(event, i)}
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
               onSwitchAgent={onSwitchAgent}
             />
          </ResizablePanel>
        </Fragment>
      ))}
    </ResizablePanelGroup>
  );
}

function paneFocusStyle(color: string): CSSProperties {
  const accent = /^#[0-9a-fA-F]{6}$/.test(color)
    ? color
    : DEFAULT_FOCUS_ACCENT_COLOR;
  const normalized = accent.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return {
    borderColor: accent,
    boxShadow: `inset 0 0 8px rgba(${red}, ${green}, ${blue}, 0.2), 0 0 12px rgba(${red}, ${green}, ${blue}, 0.35)`,
  };
}
