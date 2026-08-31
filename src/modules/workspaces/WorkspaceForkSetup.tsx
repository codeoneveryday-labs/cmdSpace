import { Button } from "@/components/ui/button";
import { AiChat01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dispatch, SetStateAction } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";

export function WorkspaceForkSetup({
  provider,
  agentLabel,
  canCreate,
  forkPrompt,
  setForkPrompt,
  onCancel,
  onCreate,
}: {
  provider: CliAgent;
  agentLabel: string;
  canCreate: boolean;
  forkPrompt: string;
  setForkPrompt: Dispatch<SetStateAction<string>>;
  onCancel: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 justify-center overflow-y-auto bg-background px-6 py-10 sm:px-10">
      <div className="flex w-full max-w-3xl self-center flex-col gap-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          New workspace
        </h1>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <AgentCliIcon agent={provider} size="md" />
            {agentLabel}
          </span>
          <span>Chat</span>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/45 p-4 shadow-sm">
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/45 px-3 py-2">
            <HugeiconsIcon
              icon={AiChat01Icon}
              size={16}
              strokeWidth={1.8}
              className="text-muted-foreground"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Chat history
              </span>
              <span className="block text-xs text-muted-foreground">
                Previous conversation
              </span>
            </span>
          </div>
          <textarea
            value={forkPrompt}
            onChange={(event) => setForkPrompt(event.target.value)}
            rows={3}
            placeholder="Message the agent, tag @files, or use /commands and /skills"
            aria-label="Fork workspace message"
            className="w-full resize-none bg-transparent px-1 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <Button
              type="button"
              disabled={!canCreate}
              onClick={onCreate}
              className="rounded-full px-4"
            >
              Create workspace
              <HugeiconsIcon icon={ArrowRight01Icon} size={15} strokeWidth={2} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
