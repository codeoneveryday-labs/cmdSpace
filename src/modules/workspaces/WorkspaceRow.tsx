import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { truncateMiddle } from "@/lib/truncateMiddle";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import { AgentStateDot } from "@/modules/terminal/AgentStateDot";
import type { WorkspaceItem } from "./WorkspacesPanel";
import { getWorkspaceCliAgent } from "./lib/workspaceAgentModel";
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
  canClose,
  onSelect,
  onClose,
  onRename,
  onColorChange,
  onDragStart,
  isDragging = false,
}: {
  workspace: WorkspaceItem;
  active: boolean;
  compact?: boolean;
  canClose: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (name: string) => void;
  onColorChange: (accentColor: string) => void;
  onDragStart?: (id: string, e: React.PointerEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
}) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState(workspace.name);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const accentColor = normalizeWorkspaceAccentColor(workspace.accentColor);
  const accentBg = colorWithAlpha(accentColor, 0.1);
  const accentBorder = colorWithAlpha(accentColor, 0.38);
  const accentGlow = colorWithAlpha(accentColor, 0.26);
  const workspaceAgent = getWorkspaceCliAgent(workspace.terminals);
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
    if (!renameDialogOpen) return;
    setDraftName(workspace.name);
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [renameDialogOpen, workspace.name]);

  const confirmRename = () => {
    const nextName = draftName.trim();
    if (nextName.length > 0 && nextName !== workspace.name) {
      onRename(nextName);
    }
    setRenameDialogOpen(false);
  };

  const handleRowSelect = (event: React.MouseEvent<HTMLDivElement>) => {
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

  const workspaceActions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            !active && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
          aria-label={`Workspace actions for ${workspace.name}`}
          title={`Workspace actions for ${workspace.name}`}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={15} strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 min-w-0 rounded-lg p-1">
        <DropdownMenuItem
          onSelect={() => setRenameDialogOpen(true)}
          className="rounded-md px-2 py-1.5 text-xs"
        >
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={!canClose}
          onSelect={onClose}
          className="rounded-md px-2 py-1.5 text-xs"
        >
          Delete workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renameDialog = (
    <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
      <DialogContent className="gap-5 rounded-[28px] p-6 sm:max-w-[520px]">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-xl font-semibold">Rename Workspace</DialogTitle>
          <DialogDescription className="text-base leading-6">
            Only the display name changes. The actual folder path will stay the same.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={`workspace-name-${workspace.id}`}>Workspace name</Label>
          <Input
            id={`workspace-name-${workspace.id}`}
            ref={inputRef}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirmRename();
              }
            }}
            aria-label={`Rename ${workspace.name}`}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={confirmRename}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (compact) {
    return (
      <>
        <div
          data-workspace-id={workspace.id}
          onClick={handleRowSelect}
          onPointerDown={(e) => {
            if (onDragStart) {
              if (e.button !== 0) return;
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
          {colorPicker}
          {workspaceAgent ? (
            <AgentCliIcon agent={workspaceAgent} size="xs" />
          ) : (
            <WorkspaceModeIcon workspace={workspace} />
          )}
          {workspace.state ? <AgentStateDot state={workspace.state} /> : null}
          <button
            type="button"
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
          {workspaceActions}
        </div>
        {renameDialog}
      </>
    );
  }

  return (
    <>
      <div
        data-workspace-id={workspace.id}
        onClick={handleRowSelect}
        onPointerDown={(e) => {
          if (onDragStart) {
            if (e.button !== 0) return;
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
        {colorPicker}
        {workspaceAgent ? (
          <AgentCliIcon agent={workspaceAgent} size="xs" />
        ) : (
          <WorkspaceModeIcon workspace={workspace} />
        )}
        {workspace.state ? <AgentStateDot state={workspace.state} /> : null}
        <button
          type="button"
          onClick={onSelect}
          aria-current={active ? "page" : undefined}
          aria-label={workspace.name}
          title={workspace.name}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {truncateMiddle(workspace.name, 28)}
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
        {workspaceActions}
      </div>
      {renameDialog}
    </>
  );
}
