import { cn } from "@/lib/utils";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import {
  CanvasTerminalNode,
  type CanvasTerminalHandle,
} from "../CanvasTerminalNode";
import type {
  ArchitectureNode,
} from "../lib/architectureCanvasTypes";
import type { TerminalDockRect, TerminalDockStackLayout } from "../terminalDockLayout";
import { CanvasSurfaceSelectionOverlay } from "./CanvasSurfaceSelectionOverlay";

type SurfaceTab = {
  id: string;
  label: string;
  kind: "terminal" | "browser";
  agent: CliAgent | null;
};

export function CanvasTerminalSurface({
  node,
  layout,
  cornerClassName,
  terminalGroupLocked,
  bounds,
  selectionBounds,
  stackTabs,
  visible,
  selected,
  maximized,
  usesSharedHeader,
  terminalResizePaused,
  panning,
  onHandleChange,
  onToggleGroupLock,
  onToggleGroupMaximize,
  onRequestCloseGroup,
  onCanvasPanStart,
  onCanvasPanMove,
  onCanvasPanEnd,
  onCanvasWheel,
  onActivate,
  onActivateTab,
  onTabPointerDown,
  onRequestCloseTab,
  onAddTab,
  onSplitRight,
  onHeaderPointerDown,
  onCwdChange,
  onInitialCommandChange,
  onResizePointerDown,
}: {
  node: ArchitectureNode;
  layout?: TerminalDockStackLayout;
  cornerClassName: string;
  terminalGroupLocked: boolean;
  bounds: TerminalDockRect;
  selectionBounds: TerminalDockRect;
  stackTabs: SurfaceTab[];
  visible: boolean;
  selected: boolean;
  maximized: boolean;
  usesSharedHeader: boolean;
  terminalResizePaused: boolean;
  panning: boolean;
  onHandleChange: (nodeId: string, handle: CanvasTerminalHandle | null) => void;
  onToggleGroupLock: () => void;
  onToggleGroupMaximize: () => void;
  onRequestCloseGroup: () => void;
  onCanvasPanStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasPanMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasPanEnd: () => void;
  onCanvasWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  onActivate: () => void;
  onActivateTab: (terminalId: string) => void;
  onTabPointerDown: (
    terminalId: string,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onRequestCloseTab: (terminalId: string) => void;
  onAddTab: (initialCommand?: string) => void;
  onSplitRight: () => void;
  onHeaderPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCwdChange: (cwd: string) => void;
  onInitialCommandChange: (command: string) => void;
  onResizePointerDown: (
    event: ReactPointerEvent<SVGRectElement>,
    node: ArchitectureNode,
    handle: "nw" | "ne" | "se" | "sw",
  ) => void;
}) {
  return (
    <div
      className={cn(
        "absolute",
        selected && "z-20",
        visible
          ? "pointer-events-auto visible"
          : "pointer-events-none invisible",
      )}
      style={{
        left: `${bounds.x}px`,
        top: `${bounds.y}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        transform: `rotate(${node.rotation ?? 0}deg)`,
        transformOrigin: "center",
      }}
    >
      <CanvasTerminalNode
        terminalId={node.id}
        initialCwd={node.cwd}
        initialCommand={node.initialCommand}
        onHandleChange={(handle) => onHandleChange(node.id, handle)}
        stackTabs={stackTabs}
        activeTabId={layout?.activeTerminalId ?? node.id}
        singleTerminalGroup={!usesSharedHeader}
        terminalGroupLocked={terminalGroupLocked}
        maximized={maximized}
        onToggleTerminalGroupLock={onToggleGroupLock}
        onToggleTerminalGroupMaximize={onToggleGroupMaximize}
        onRequestCloseTerminalGroup={onRequestCloseGroup}
        visible={visible}
        resizePaused={terminalResizePaused}
        panning={panning}
        onCanvasPanStart={onCanvasPanStart}
        onCanvasPanMove={onCanvasPanMove}
        onCanvasPanEnd={onCanvasPanEnd}
        onCanvasWheel={onCanvasWheel}
        cornerClassName={cornerClassName}
        onActivate={onActivate}
        onActivateTab={onActivateTab}
        onTabPointerDown={onTabPointerDown}
        onRequestCloseTab={onRequestCloseTab}
        onAddTab={onAddTab}
        onSplitRight={onSplitRight}
        onHeaderPointerDown={onHeaderPointerDown}
        onCwdChange={onCwdChange}
        onInitialCommandChange={onInitialCommandChange}
      />
      <CanvasSurfaceSelectionOverlay
        node={node}
        bounds={bounds}
        selectionBounds={selectionBounds}
        selected={selected}
        onResizePointerDown={onResizePointerDown}
      />
    </div>
  );
}
