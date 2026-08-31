import { CanvasBrowserNode } from "../CanvasBrowserNode";
import { cn } from "@/lib/utils";
import type {
  ArchitectureNode,
} from "../lib/architectureCanvasTypes";
import type { TerminalDockRect, TerminalDockStackLayout } from "../terminalDockLayout";
import type { PointerEvent as ReactPointerEvent } from "react";
import { CanvasSurfaceSelectionOverlay } from "./CanvasSurfaceSelectionOverlay";

type SurfaceTab = {
  id: string;
  label: string;
  kind: "terminal" | "browser";
};

export function CanvasBrowserSurface({
  node,
  layout,
  bounds,
  visible,
  selected,
  maximized,
  usesSharedHeader,
  surfaceGroupLocked,
  interactionBlocked,
  boundsRevision,
  stackTabs,
  onUrlChange,
  onActivate,
  onActivateTab,
  onTabPointerDown,
  onRequestCloseTab,
  onAddTab,
  onSplitRight,
  onHeaderPointerDown,
  onToggleSurfaceGroupLock,
  onToggleSurfaceGroupMaximize,
  onRequestCloseSurfaceGroup,
  onResizePointerDown,
}: {
  node: ArchitectureNode;
  layout?: TerminalDockStackLayout;
  bounds: TerminalDockRect;
  visible: boolean;
  selected: boolean;
  maximized: boolean;
  usesSharedHeader: boolean;
  surfaceGroupLocked: boolean;
  interactionBlocked: boolean;
  boundsRevision: string;
  stackTabs: SurfaceTab[];
  onUrlChange: (url: string) => void;
  onActivate: () => void;
  onActivateTab: (id: string) => void;
  onTabPointerDown: (
    id: string,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onRequestCloseTab: (id: string) => void;
  onAddTab: () => void;
  onSplitRight: () => void;
  onHeaderPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleSurfaceGroupLock: () => void;
  onToggleSurfaceGroupMaximize: () => void;
  onRequestCloseSurfaceGroup: () => void;
  onResizePointerDown: (
    event: ReactPointerEvent<SVGRectElement>,
    node: ArchitectureNode,
    handle: "nw" | "ne" | "se" | "sw",
  ) => void;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto absolute",
        selected && "z-20",
        visible ? "visible" : "pointer-events-none invisible",
      )}
      style={{
        left: `${bounds.x}px`,
        top: `${bounds.y}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
      }}
    >
      <CanvasBrowserNode
        url={node.url ?? ""}
        active={visible}
        interactionBlocked={interactionBlocked}
        boundsRevision={boundsRevision}
        stackTabs={stackTabs}
        activeTabId={layout?.activeTerminalId ?? node.id}
        singleSurfaceGroup={!usesSharedHeader}
        surfaceGroupLocked={surfaceGroupLocked}
        maximized={maximized}
        onUrlChange={onUrlChange}
        onActivate={onActivate}
        onActivateTab={onActivateTab}
        onTabPointerDown={onTabPointerDown}
        onRequestCloseTab={onRequestCloseTab}
        onAddTab={onAddTab}
        onSplitRight={onSplitRight}
        onHeaderPointerDown={onHeaderPointerDown}
        onToggleSurfaceGroupLock={onToggleSurfaceGroupLock}
        onToggleSurfaceGroupMaximize={onToggleSurfaceGroupMaximize}
        onRequestCloseSurfaceGroup={onRequestCloseSurfaceGroup}
      />
      <CanvasSurfaceSelectionOverlay
        node={node}
        bounds={bounds}
        selectionBounds={bounds}
        selected={selected}
        onResizePointerDown={onResizePointerDown}
      />
    </div>
  );
}
