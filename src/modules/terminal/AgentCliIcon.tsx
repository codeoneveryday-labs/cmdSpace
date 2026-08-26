import { cn } from "@/lib/utils";
import { BrandIcon } from "@/components/BrandIcon";
import { getAgentBrandIcon } from "@/components/brandIcons";
import {
  CodeIcon,
  Robot01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CLI_AGENT_BY_ID,
  type CliAgent,
} from "./lib/cliAgents";

const FALLBACK_ICON_BY_AGENT: Partial<Record<CliAgent, typeof CodeIcon>> = {
  aider: CodeIcon,
  cmd: CodeIcon,
};

type Props = {
  agent: CliAgent;
  size?: "xs" | "sm" | "md";
  className?: string;
};

export function AgentCliIcon({ agent, size = "sm", className }: Props) {
  const brandIcon = getAgentBrandIcon(agent);
  const label = CLI_AGENT_BY_ID[agent].name;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-foreground",
        className,
      )}
      title={label}
      aria-label={label}
    >
      {brandIcon ? (
        <BrandIcon name={brandIcon} size={size === "md" ? 14 : size === "xs" ? 10 : 12} />
      ) : (
        <HugeiconsIcon
          icon={FALLBACK_ICON_BY_AGENT[agent] ?? Robot01Icon}
          size={size === "md" ? 14 : size === "xs" ? 10 : 12}
          strokeWidth={2}
        />
      )}
    </span>
  );
}
