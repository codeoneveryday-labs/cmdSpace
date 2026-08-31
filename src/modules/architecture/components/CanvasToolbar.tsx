import {
  Cursor01Icon,
  Globe02Icon,
  HashtagIcon,
  LockIcon,
  MinusSignIcon,
  PencilEdit01Icon,
  SquareUnlock01Icon,
  TerminalIcon,
  TextIcon,
  UndoIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { PanToolIcon } from "./PanToolIcon";
import { ToolButton } from "./ToolButton";
import type { CanvasMode, LiveSurfaceKind } from "../lib/architectureCanvasTypes";

const TOOL_SHORTCUTS: Partial<Record<CanvasMode, string>> = {
  select: "V",
  pan: "H",
  connect: "C",
  line: "L",
  arrow: "A",
  pen: "P",
  text: "T",
  image: "I",
  frame: "F",
  eraser: "E",
};

export function CanvasToolbar({
  mode,
  pendingSurfaceKind,
  selectedLocked,
  hasSelection,
  historySize,
  zoom,
  onModeChange,
  onBeginSurfacePlacement,
  onToggleSelectedLock,
  onUndo,
  onZoomBy,
}: {
  mode: CanvasMode;
  pendingSurfaceKind: LiveSurfaceKind | null;
  selectedLocked: boolean;
  hasSelection: boolean;
  historySize: number;
  zoom: number;
  onModeChange: (mode: CanvasMode) => void;
  onBeginSurfacePlacement: (kind: LiveSurfaceKind) => void;
  onToggleSelectedLock: () => void;
  onUndo: () => void;
  onZoomBy: (delta: number) => void;
}) {
  const selectMode = (nextMode: CanvasMode) => onModeChange(nextMode);
  return (
    <div className="absolute bottom-6 left-1/2 z-30 flex min-h-16 max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-[2.5rem] border border-zinc-300/90 bg-white/95 px-3 py-2 text-zinc-800 shadow-[0_10px_28px_rgba(15,23,42,0.15)] backdrop-blur-xl transition-all duration-200 motion-reduce:transition-none dark:border-zinc-700/90 dark:bg-zinc-900/95 dark:text-zinc-200 dark:shadow-[0_10px_28px_rgba(0,0,0,0.38)]">
      <ToolButton
        active={mode === "select"}
        icon={Cursor01Icon}
        label="Select"
        shortcut={TOOL_SHORTCUTS.select}
        onClick={() => selectMode("select")}
      />
      <ToolButton
        active={mode === "pan"}
        iconNode={<PanToolIcon />}
        label="Pan"
        shortcut={TOOL_SHORTCUTS.pan}
        onClick={() => selectMode("pan")}
      />
      <ToolButton
        active={mode === "line"}
        icon={MinusSignIcon}
        label="Line"
        shortcut={TOOL_SHORTCUTS.line}
        onClick={() => selectMode("line")}
      />
      <ToolButton
        active={mode === "pen"}
        icon={PencilEdit01Icon}
        label="Pen"
        shortcut={TOOL_SHORTCUTS.pen}
        onClick={() => selectMode("pen")}
      />
      <ToolButton
        active={mode === "text"}
        icon={TextIcon}
        label="Text"
        shortcut={TOOL_SHORTCUTS.text}
        onClick={() => selectMode("text")}
      />
      <ToolButton
        active={pendingSurfaceKind === "terminal"}
        icon={TerminalIcon}
        label="Add terminal"
        shortcut={TOOL_SHORTCUTS.image}
        onClick={() => onBeginSurfacePlacement("terminal")}
      />
      <ToolButton
        active={pendingSurfaceKind === "browser"}
        icon={Globe02Icon}
        label="Add browser"
        onClick={() => onBeginSurfacePlacement("browser")}
      />
      <ToolButton
        active={mode === "frame"}
        icon={HashtagIcon}
        label="Frame"
        shortcut={TOOL_SHORTCUTS.frame}
        onClick={() => selectMode("frame")}
      />
      <ToolButton
        active={selectedLocked}
        disabled={!hasSelection}
        icon={selectedLocked ? SquareUnlock01Icon : LockIcon}
        label={selectedLocked ? "Unlock" : "Lock"}
        onClick={onToggleSelectedLock}
      />
      <ToolButton
        disabled={historySize === 0}
        icon={UndoIcon}
        label="Undo"
        onClick={onUndo}
      />
      <span aria-hidden="true" className="mx-1 h-8 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="h-11 w-11 shrink-0 rounded-full text-3xl font-normal text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        title="Zoom out"
        aria-label="Zoom out"
        onClick={() => onZoomBy(-0.15)}
      >
        −
      </Button>
      <span
        aria-label={`Current zoom: ${Math.round(zoom * 100)}%`}
        className="min-w-14 shrink-0 text-center text-base font-medium tabular-nums text-zinc-700 dark:text-zinc-300"
      >
        {Math.round(zoom * 100)}%
      </span>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="h-11 w-11 shrink-0 rounded-full text-3xl font-normal text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        title="Zoom in"
        aria-label="Zoom in"
        onClick={() => onZoomBy(0.15)}
      >
        +
      </Button>
    </div>
  );
}
