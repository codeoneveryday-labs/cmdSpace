import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Add01Icon,
  ArrowDown01Icon,
  Download01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function WorkspacePanelHeader({
  compact,
  activeWorkspaceId,
  onStartWorkspaceSetup,
  onImportSession,
}: {
  compact: boolean;
  activeWorkspaceId: string | null;
  onStartWorkspaceSetup: () => void;
  onImportSession: () => void;
}) {
  return (
    <header
      className={
        `flex h-10 shrink-0 items-center border-b border-border/60 ${
          compact ? "gap-1 px-2" : "gap-1 px-3"
        }`
      }
    >
      <div
        className={`min-w-0 flex-1 truncate font-semibold uppercase tracking-[0.08em] text-muted-foreground ${
          compact ? "text-[10px]" : "text-[11px] tracking-[0.12em]"
        }`}
      >
        WORKSPACES
      </div>
      <button
        type="button"
        onClick={onStartWorkspaceSetup}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label="New workspace"
        title="New workspace"
      >
        <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Workspace menu"
            title="Workspace menu"
          >
            <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44 rounded-xl p-1">
          <DropdownMenuItem
            onSelect={onStartWorkspaceSetup}
            className="gap-2 rounded-md py-1.5 text-sm"
          >
            <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={1.8} />
            New workspace
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={onImportSession}
            disabled={activeWorkspaceId === null}
            className="gap-2 rounded-md py-1.5 text-sm"
          >
            <HugeiconsIcon icon={Download01Icon} size={15} strokeWidth={1.8} />
            Import agent session
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
