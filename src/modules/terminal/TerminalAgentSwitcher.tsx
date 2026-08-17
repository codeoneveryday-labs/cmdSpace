import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { ComputerTerminal02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AgentCliIcon } from "./AgentCliIcon";
import {
  CLI_AGENT_BY_ID,
  getEnabledCliAgentDefinitions,
  type CliAgent,
} from "./lib/cliAgents";

type Props = {
  currentAgent: CliAgent | null;
  onSelect: (agent: CliAgent | null, command: string | null) => void;
};

export function resolveAgentSwitchCommand(
  agent: CliAgent | null,
  overrides: Record<string, string>,
): string | null {
  if (!agent) return null;
  const definition = CLI_AGENT_BY_ID[agent];
  return overrides[agent]?.trim() || definition.launch || definition.command;
}

export function TerminalAgentSwitcher({ currentAgent, onSelect }: Props) {
  const configuredIds = usePreferencesStore((state) => state.cliAgentIds);
  const disabledIds = usePreferencesStore(
    (state) => state.disabledCliAgentIds,
  );
  const commandOverrides = usePreferencesStore(
    (state) => state.agentLaunchCommands,
  );
  const enabledAgents = getEnabledCliAgentDefinitions(
    configuredIds,
    disabledIds,
  );
  const currentValue = currentAgent ?? "terminal";
  const currentLabel = currentAgent
    ? CLI_AGENT_BY_ID[currentAgent].name
    : "Terminal";

  const selectAgent = (value: string) => {
    const agent = value === "terminal" ? null : (value as CliAgent);
    if (agent === currentAgent) return;
    onSelect(agent, resolveAgentSwitchCommand(agent, commandOverrides));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="grid size-6 shrink-0 place-items-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-zinc-800"
          aria-label={`Switch coding agent. Current: ${currentLabel}`}
          title={`Switch coding agent · ${currentLabel}`}
        >
          {currentAgent ? (
            <AgentCliIcon agent={currentAgent} />
          ) : (
            <HugeiconsIcon
              icon={ComputerTerminal02Icon}
              size={14}
              strokeWidth={1.8}
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="min-w-56 rounded-xl p-1.5"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuRadioGroup
          value={currentValue}
          onValueChange={selectAgent}
        >
          {enabledAgents.map((agent) => (
            <DropdownMenuRadioItem
              key={agent.id}
              value={agent.id}
              className="rounded-lg"
            >
              <AgentCliIcon agent={agent.id} size="md" />
              <span className="min-w-0 flex-1 truncate">{agent.name}</span>
            </DropdownMenuRadioItem>
          ))}
          {enabledAgents.length > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuRadioItem value="terminal" className="rounded-lg">
            <HugeiconsIcon
              icon={ComputerTerminal02Icon}
              size={16}
              strokeWidth={1.8}
            />
            <span className="min-w-0 flex-1 truncate">Terminal</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
