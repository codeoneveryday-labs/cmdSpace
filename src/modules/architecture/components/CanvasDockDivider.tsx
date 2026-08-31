import { cn } from "@/lib/utils";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { TerminalDockDividerLayout } from "../terminalDockLayout";

export function CanvasDockDivider({
  divider,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
}: {
  divider: TerminalDockDividerLayout;
  onPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) => void;
  onPointerMove: (
    event: ReactPointerEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onKeyDown: (
    event: ReactKeyboardEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) => void;
}) {
  const vertical = divider.direction === "horizontal";
  const position = vertical
    ? {
        left: `${divider.rect.x + divider.rect.width * divider.ratio - 4}px`,
        top: `${divider.rect.y}px`,
        width: "8px",
        height: `${divider.rect.height}px`,
      }
    : {
        left: `${divider.rect.x}px`,
        top: `${divider.rect.y + divider.rect.height * divider.ratio - 4}px`,
        width: `${divider.rect.width}px`,
        height: "8px",
      };

  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={`Resize docked terminals ${vertical ? "horizontally" : "vertically"}`}
      tabIndex={0}
      className={cn(
        "pointer-events-auto absolute z-30 outline-none after:absolute after:bg-border/70 hover:after:bg-blue-500 focus-visible:after:bg-blue-500",
        vertical
          ? "cursor-col-resize after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2"
          : "cursor-row-resize after:left-0 after:top-1/2 after:h-px after:w-full after:-translate-y-1/2",
      )}
      style={position}
      onPointerDown={(event) => onPointerDown(event, divider)}
      onPointerMove={(event) => onPointerMove(event, divider)}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(event) => onKeyDown(event, divider)}
    />
  );
}
