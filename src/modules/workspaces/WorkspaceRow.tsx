import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowDown01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { truncateMiddle } from "@/lib/truncateMiddle";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { AgentStateDot } from "@/modules/terminal/AgentStateDot";
import type { WorkspaceItem } from "./WorkspacesPanel";
import {
  normalizeWorkspaceAccentColor,
  WorkspaceColorPicker,
  WorkspaceModeIcon,
  colorWithAlpha,
} from "./WorkspaceRowPrimitives";

export function WorkspaceRow({
  workspace,
  active,
  compact = false,
  expanded,
  canClose,
  onSelect,
  onToggleExpanded,
  onClose,
  onRename,
  onColorChange,
  onDragStart,
  isDragging = false,
}: {
  workspace: WorkspaceItem;
  active: boolean;
  compact?: boolean;
  expanded: boolean;
  canClose: boolean;
  onSelect: () => void;
  onToggleExpanded: () => void;
  onClose: () => void;
  onRename: (name: string) => void;
  onColorChange: (accentColor: string) => void;
  onDragStart?: (id: string, e: React.PointerEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(workspace.name);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const accentColor = normalizeWorkspaceAccentColor(workspace.accentColor);
  const accentBg = colorWithAlpha(accentColor, 0.1);
  const accentBorder = colorWithAlpha(accentColor, 0.38);
  const accentGlow = colorWithAlpha(accentColor, 0.26);
  const canExpand = true;
  const toggleLabel = expanded
    ? `Hide terminals for ${workspace.name}`
    : `Show terminals for ${workspace.name}`;
  const activeRowStyle =
    active || isDragging
      ? {
          touchAction: "none",
          borderColor: accentBorder,
          backgroundColor: active
            ? accentBg
            : colorWithAlpha(accentColor, 0.14),
          boxShadow: `inset 0 0 0 1px ${colorWithAlpha(accentColor, 0.16)}, 0 0 0 1px ${colorWithAlpha(accentColor, 0.1)}`,
        }
      : { touchAction: "none" };

  useEffect(() => {
    if (!renaming) setDraftName(workspace.name);
  }, [renaming, workspace.name]);

  useEffect(() => {
    if (!renaming) return;
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [renaming]);

  useEffect(() => {
    if (compact && renaming) setRenaming(false);
  }, [compact, renaming]);

  const commitRename = () => {
    const nextName = draftName.trim();
    setRenaming(false);
    if (nextName.length > 0 && nextName !== workspace.name) {
      onRename(nextName);
    } else {
      setDraftName(workspace.name);
    }
  };

  const handleRowSelect = (event: React.MouseEvent<HTMLDivElement>) => {
    if (renaming) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    if (target.closest("input")) return;
    onSelect();
  };

  const colorPicker = (
    <WorkspaceColorPicker
      workspaceName={workspace.name}
      accentColor={accentColor}
      onColorChange={onColorChange}
    />
  );

  if (compact) {
    return (
      <div
        data-workspace-id={workspace.id}
        onClick={handleRowSelect}
        onPointerDown={(e) => {
          if (onDragStart) {
            if (renaming || e.button !== 0) return;
            const target = e.target as HTMLElement;
            if (target.closest("button") && !target.closest("button.min-w-0")) {
              return;
            }
            onDragStart(workspace.id, e);
          }
        }}
        style={activeRowStyle}
        className={cn(
          "group flex h-9 w-full items-center gap-1.5 rounded-md border px-2 text-left outline-none transition-colors select-none",
          active
            ? "text-foreground"
            : "border-transparent text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
          isDragging && "scale-[1.02] cursor-grabbing opacity-80 shadow-lg",
        )}
        title={workspace.name}
      >
        {canExpand ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded();
            }}
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={13}
              strokeWidth={2}
              className={cn("transition-transform duration-150", !expanded && "-rotate-90")}
            />
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden="true" />
        )}
        {colorPicker}
        <WorkspaceModeIcon workspace={workspace} />
        {workspace.state ? <AgentStateDot state={workspace.state} /> : null}
        <button
          type="button"
          disabled={!canClose}
          onClick={onSelect}
          aria-current={active ? "page" : undefined}
          aria-label={workspace.name}
          title={workspace.name}
          className="min-w-0 flex-1 truncate text-left text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {truncateMiddle(workspace.name, 22)}
        </button>
        <span
          className={cn(
            "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums",
            active ? "shadow-sm" : "",
          )}
          style={{
            backgroundColor: colorWithAlpha(accentColor, active ? 0.16 : 0.12),
            color: accentColor,
            boxShadow: active ? `0 0 14px ${accentGlow}` : undefined,
          }}
        >
          {workspace.count}
        </span>
      </div>
    );
  }

  return (
    <div
      data-workspace-id={workspace.id}
      onClick={handleRowSelect}
      onPointerDown={(e) => {
        if (onDragStart) {
          if (renaming || e.button !== 0) return;
          const target = e.target as HTMLElement;
          if (target.closest("button") && !target.closest("button.min-w-0")) {
            return;
          }
          if (target.closest("input")) return;
          onDragStart(workspace.id, e);
        }
      }}
      style={activeRowStyle}
      className={cn(
        "group flex h-9 w-full items-center gap-2 rounded-md border px-2 text-left outline-none transition-colors select-none",
        active
          ? "text-foreground"
          : "border-transparent text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
        isDragging && "scale-[1.02] cursor-grabbing opacity-80 shadow-lg",
      )}
    >
      {canExpand ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpanded();
          }}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={13}
            strokeWidth={2}
            className={cn("transition-transform duration-150", !expanded && "-rotate-90")}
          />
        </button>
      ) : (
        <span className="size-5 shrink-0" aria-hidden="true" />
      )}
      {colorPicker}
      <WorkspaceModeIcon workspace={workspace} />
      {workspace.state ? <AgentStateDot state={workspace.state} /> : null}
      {renaming ? (
        <Input
          ref={inputRef}
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitRename();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraftName(workspace.name);
              setRenaming(false);
            }
          }}
          className="h-7 min-w-0 flex-1 rounded-sm border-blue-400/45 bg-background/80 px-1.5 text-sm font-medium text-foreground shadow-none focus-visible:ring-2 focus-visible:ring-blue-400/35"
          aria-label={`Rename ${workspace.name}`}
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={() => setRenaming(true)}
          aria-current={active ? "page" : undefined}
          aria-label={workspace.name}
          title={workspace.name}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {truncateMiddle(workspace.name, 28)}
        </button>
      )}
      <span
        className={cn(
          "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums",
          active ? "shadow-sm" : "",
        )}
        style={{
          backgroundColor: colorWithAlpha(accentColor, active ? 0.16 : 0.12),
          color: accentColor,
          boxShadow: active ? `0 0 14px ${accentGlow}` : undefined,
        }}
      >
        {workspace.count}
      </span>
      {active ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors group-hover:bg-foreground/[0.06] disabled:pointer-events-none disabled:opacity-30"
          style={{ color: accentColor }}
          aria-label={`Delete ${workspace.name}`}
          title={canClose ? `Delete ${workspace.name}` : "At least one workspace is required"}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2} />
        </button>
      ) : (
        <button
          type="button"
          disabled={!canClose}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-30"
          aria-label={`Delete ${workspace.name}`}
          title={canClose ? `Delete ${workspace.name}` : "At least one workspace is required"}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
