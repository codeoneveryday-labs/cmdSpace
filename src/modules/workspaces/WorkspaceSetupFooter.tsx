import { Button } from "@/components/ui/button";
import { ArrowLeft02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { WorkspaceMode } from "./WorkspacesPanel";

export function WorkspaceSetupFooter({
  setupStep,
  workspaceMode,
  terminalCount,
  plannedAgentCommands,
  selectedChatAgent,
  selectedFolder,
  onBack,
  onOpenWorkspace,
  onPrimaryAction,
}: {
  setupStep: "layout" | "agents";
  workspaceMode: WorkspaceMode;
  terminalCount: number;
  plannedAgentCommands: string[];
  selectedChatAgent: string | null;
  selectedFolder: string;
  onBack: () => void;
  onOpenWorkspace: () => void;
  onPrimaryAction: () => void;
}) {
  return (
    <footer className="mt-2 flex flex-col gap-3 pt-2 sm:mt-3 sm:flex-row sm:items-center sm:justify-between">
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="w-full justify-center text-muted-foreground sm:w-auto"
      >
        <HugeiconsIcon icon={ArrowLeft02Icon} size={14} strokeWidth={2} />
        Back
      </Button>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
        {setupStep === "layout" ? (
          <>
            {workspaceMode !== "agent" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onOpenWorkspace}
                className="w-full justify-center text-muted-foreground sm:w-auto"
              >
                Open without AI
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={onPrimaryAction}
              className="w-full justify-center sm:w-auto"
            >
              Next: Add AI agents
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={14}
                strokeWidth={2}
                data-icon="inline-end"
              />
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={onOpenWorkspace}
              className="w-full justify-center text-muted-foreground sm:w-auto"
            >
              {workspaceMode === "agent" ? "Back to workspace" : "Skip - no agents"}
            </Button>
            <Button
              type="button"
              disabled={
                plannedAgentCommands.length === 0 ||
                (workspaceMode === "agent" &&
                  (!selectedChatAgent || !selectedFolder))
              }
              onClick={onPrimaryAction}
              aria-label={`Launch ${plannedAgentCommands.length} configured agents in ${terminalCount} terminals`}
              className="w-full justify-center sm:w-auto"
            >
              {workspaceMode === "agent"
                ? "Open agent chat"
                : `Launch ${terminalCount} terminals`}
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={14}
                strokeWidth={2}
                data-icon="inline-end"
              />
            </Button>
          </>
        )}
      </div>
    </footer>
  );
}
