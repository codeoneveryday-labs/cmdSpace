import { cn } from "@/lib/utils";
import type { ArchitectureDiagram, ArchitectureTab, Tab } from "@/modules/tabs";
import { ArchitectureCanvas } from "./ArchitectureCanvas";
import type { CanvasTerminalHandle } from "./CanvasTerminalNode";
import { ArchitectureErrorBoundary } from "./ArchitectureErrorBoundary";

type Props = {
  tabs: Tab[];
  activeId: number;
  onDiagramChange?: (tabId: number, diagram: ArchitectureDiagram) => void;
  onTerminalHandleChange?: (
    tabId: number,
    terminalId: string,
    handle: CanvasTerminalHandle | null,
  ) => void;
  onActiveTerminalChange?: (
    tabId: number,
    terminalId: string | null,
  ) => void;
  onRegisterTerminalCreator?: (
    tabId: number,
    creator: ((initialCommand?: string) => boolean) | null,
  ) => void;
  canvasFocused?: boolean;
  onToggleCanvasFocus?: () => void;
};

export function ArchitectureStack({
  tabs,
  activeId,
  onDiagramChange,
  onTerminalHandleChange,
  onActiveTerminalChange,
  onRegisterTerminalCreator,
  canvasFocused,
  onToggleCanvasFocus,
}: Props) {
  const architectureTabs = tabs.filter(
    (tab): tab is ArchitectureTab => tab.kind === "architecture",
  );

  if (architectureTabs.length === 0) return null;
  return (
    <div className="relative h-full w-full">
      {architectureTabs.map((tab) => {
        const visible = tab.id === activeId;
        return (
          <div
            key={tab.id}
            className={cn(
              "absolute inset-0",
              !visible && "hidden pointer-events-none",
            )}
            aria-hidden={!visible}
          >
            <ArchitectureErrorBoundary>
              <ArchitectureCanvas
                active={visible}
                tabId={tab.id}
                title={tab.title}
                seed={tab.diagram}
                onDiagramChange={onDiagramChange}
                onTerminalHandleChange={onTerminalHandleChange}
                onActiveTerminalChange={onActiveTerminalChange}
                onRegisterTerminalCreator={onRegisterTerminalCreator}
                canvasFocused={canvasFocused}
                onToggleCanvasFocus={onToggleCanvasFocus}
              />
            </ArchitectureErrorBoundary>
          </div>
        );
      })}
    </div>
  );
}
