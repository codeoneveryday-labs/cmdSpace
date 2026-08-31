import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  AiChat01Icon,
  CanvasIcon,
  ComputerTerminal02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import type { WorkspaceItem } from "./WorkspacesPanel";

export const WORKSPACE_ACCENT_COLORS = [
  "#10B981",
  "#14B8A6",
  "#0EA5E9",
  "#6366F1",
  "#8B5CF6",
  "#D946EF",
  "#F43F5E",
  "#F97316",
  "#F59E0B",
  "#65A30D",
] as const;
export const DEFAULT_WORKSPACE_ACCENT_COLOR = WORKSPACE_ACCENT_COLORS[0];

export function normalizeWorkspaceAccentColor(
  color: string | null | undefined,
  fallback: string = DEFAULT_WORKSPACE_ACCENT_COLOR,
): string {
  return WORKSPACE_ACCENT_COLORS.includes(
    color as (typeof WORKSPACE_ACCENT_COLORS)[number],
  )
    ? color!
    : fallback;
}

export function WorkspaceModeIcon({ workspace }: { workspace: WorkspaceItem }) {
  const canvas = workspace.workspaceMode === "canvas";
  const agent = workspace.workspaceMode === "agent";
  const label = canvas
    ? "Canvas workspace"
    : agent
      ? "Agent chat workspace"
      : "Standard terminal workspace";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex size-4 shrink-0 items-center justify-center text-muted-foreground/80"
    >
      <HugeiconsIcon
        icon={canvas ? CanvasIcon : agent ? AiChat01Icon : ComputerTerminal02Icon}
        size={13}
        strokeWidth={1.9}
      />
    </span>
  );
}

export function WorkspaceColorPicker({
  workspaceName,
  accentColor,
  onColorChange,
}: {
  workspaceName: string;
  accentColor: string;
  onColorChange: (accentColor: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={`Change color for ${workspaceName}`}
          title={`Change color for ${workspaceName}`}
        >
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full ring-1 ring-black/5"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 0 12px ${colorWithAlpha(accentColor, 0.5)}`,
            }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={6}
        className="w-auto gap-1 rounded-xl p-1.5"
      >
        <div
          className="grid grid-cols-5 gap-1"
          role="listbox"
          aria-label="Workspace colors"
        >
          {WORKSPACE_ACCENT_COLORS.map((color) => {
            const selected = color === accentColor;
            return (
              <button
                key={color}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={`Use workspace color ${color}`}
                onClick={() => {
                  onColorChange(color);
                  setOpen(false);
                }}
                className={cn(
                  "grid size-6 place-items-center rounded-full shadow-sm ring-1 ring-black/10 outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/40",
                  selected && "ring-foreground/55",
                )}
                style={{ backgroundColor: color }}
              >
                {selected ? (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={13}
                    strokeWidth={2.4}
                    className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
