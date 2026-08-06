import { cn } from "@/lib/utils";
import {
  ChatGptIcon,
  ClaudeIcon,
  CodeIcon,
  CursorPointer01Icon,
  Github01Icon,
  GoogleGeminiIcon,
  Grok02Icon,
  Robot01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CLI_AGENT_BY_ID,
  type CliAgent,
} from "./lib/cliAgents";

const AGENT_CLI_ICON_META = {
  claude: {
    icon: ClaudeIcon,
    className: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
  },
  codex: {
    icon: ChatGptIcon,
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
  gemini: {
    icon: GoogleGeminiIcon,
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  },
  opencode: {
    icon: CodeIcon,
    className: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  },
  copilot: {
    icon: Github01Icon,
    className: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-200",
  },
  cursor: {
    icon: CursorPointer01Icon,
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-200",
  },
  aider: {
    icon: CodeIcon,
    className: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  },
  pi: {
    icon: Robot01Icon,
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  amp: {
    icon: CodeIcon,
    className: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  },
  cline: {
    icon: Robot01Icon,
    className: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  goose: {
    icon: Robot01Icon,
    className: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
  },
  qwen: {
    icon: CodeIcon,
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  kimi: {
    icon: CodeIcon,
    className: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
  },
  openhands: {
    icon: Robot01Icon,
    className: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  },
  kiro: {
    icon: Robot01Icon,
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
  grok: {
    icon: Grok02Icon,
    className: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300",
  },
  cmd: {
    icon: CodeIcon,
    className: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  },
} as const satisfies Record<
  CliAgent,
  { icon: typeof ClaudeIcon; className: string }
>;

type Props = {
  agent: CliAgent;
  size?: "sm" | "md";
  className?: string;
};

export function AgentCliIcon({ agent, size = "sm", className }: Props) {
  const meta = AGENT_CLI_ICON_META[agent];
  const label = CLI_AGENT_BY_ID[agent].name;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        size === "md" ? "size-7" : "size-6",
        meta.className,
        className,
      )}
      title={label}
      aria-label={label}
    >
      <HugeiconsIcon
        icon={meta.icon}
        size={size === "md" ? 17 : 15}
        strokeWidth={2}
      />
    </span>
  );
}
