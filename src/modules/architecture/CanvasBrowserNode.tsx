import { SidebarBrowserPane } from "@/modules/preview";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  CanvasSurfaceChrome,
  type CanvasSurfaceTab,
} from "./CanvasSurfaceChrome";

type Props = {
  url: string;
  active: boolean;
  interactionBlocked: boolean;
  boundsRevision: string | number;
  stackTabs: CanvasSurfaceTab[];
  activeTabId: string;
  singleSurfaceGroup: boolean;
  surfaceGroupLocked: boolean;
  maximized: boolean;
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
};

export function CanvasBrowserNode({
  url,
  active,
  interactionBlocked,
  boundsRevision,
  stackTabs,
  activeTabId,
  singleSurfaceGroup,
  surfaceGroupLocked,
  maximized,
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
}: Props) {
  return (
    <CanvasSurfaceChrome
      kind="browser"
      tabs={stackTabs}
      activeTabId={activeTabId}
      singleSurfaceGroup={singleSurfaceGroup}
      surfaceGroupLocked={surfaceGroupLocked}
      maximized={maximized}
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
    >
      <div data-canvas-browser-node="true" className="relative h-full min-h-0 overflow-hidden rounded-[inherit]">
        <SidebarBrowserPane
          url={url}
          visible={active}
          resizing={interactionBlocked}
          boundsRevision={boundsRevision}
          onUrlChange={onUrlChange}
        />
      </div>
    </CanvasSurfaceChrome>
  );
}
