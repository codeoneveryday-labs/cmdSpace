import { Button } from "@/components/ui/button";
import { ArrowLeft02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function WorkspaceSetupFooter({
  setupStep,
  terminalCount,
  plannedAgentCommands,
  onBack,
  onOpenWorkspace,
  onPrimaryAction,
}: {
  setupStep: "layout" | "agents";
  terminalCount: number;
  plannedAgentCommands: string[];
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
            <Button
              type="button"
              variant="ghost"
              onClick={onOpenWorkspace}
              className="w-full justify-center text-muted-foreground sm:w-auto"
            >
              Open without AI
            </Button>
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
                Skip - no agents
            </Button>
            <Button
              type="button"
              disabled={plannedAgentCommands.length === 0}
              onClick={onPrimaryAction}
              aria-label={
                `Launch ${plannedAgentCommands.length} configured agents in ${terminalCount} terminals`
              }
              className="w-full justify-center sm:w-auto"
            >
              Launch {terminalCount} terminals
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
