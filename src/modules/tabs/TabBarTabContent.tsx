import { cn } from "@/lib/utils";
import { fileIconUrl } from "@/modules/explorer/lib/iconResolver";
import { AgentStateDot, type AgentDisplayState } from "@/modules/terminal/AgentStateDot";
import { findLeafLastCommand, leafIds } from "@/modules/terminal/lib/panes";
import { detectCliAgent } from "@/modules/terminal/lib/cliAgents";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import {
  AiChat01Icon,
  CanvasIcon,
  Clock01Icon,
  ComputerTerminal02Icon,
  GitCompareIcon,
  Globe02Icon,
  IncognitoIcon,
  MusicNote01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { EditorTab, Tab } from "./lib/useTabs";

export function TabBarTabContent({
  tab,
  compact,
  musicPlaying,
  agentState,
}: {
  tab: Tab;
  compact?: boolean;
  musicPlaying: boolean;
  agentState?: AgentDisplayState;
}) {
  const isPreview = tab.kind === "editor" && (tab as EditorTab).preview;
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 truncate",
        compact ? "max-w-48" : "max-w-80",
      )}
    >
      {agentState ? <AgentStateDot state={agentState} /> : null}
      <TabIcon tab={tab} musicPlaying={musicPlaying} />
      {/* Preview tabs use italic to signal the transient state,
          matching the visual convention from VSCode. */}
      <span className={cn("truncate", isPreview && "italic")}>
        {labelFor(tab)}
      </span>
      {tab.kind === "editor" && tab.dirty ? (
        <span
          aria-label="Unsaved changes"
          className="size-1.5 shrink-0 rounded-full bg-foreground/70"
        />
      ) : null}
    </span>
  );
}

function TabIcon({ tab, musicPlaying }: { tab: Tab; musicPlaying: boolean }) {
  if (tab.kind === "terminal") {
    const agent = leafIds(tab.paneTree)
      .map((leafId) => detectCliAgent(findLeafLastCommand(tab.paneTree, leafId) ?? undefined))
      .find((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
    if (agent) return <AgentCliIcon agent={agent} size="xxs" className="shrink-0" />;
  }
  if (tab.kind === "terminal" && tab.title === "Music CLI") {
    return (
      <HugeiconsIcon
        icon={MusicNote01Icon}
        size={14}
        strokeWidth={2}
        className={cn("shrink-0", musicPlaying && "cmdspace-music-tab-icon")}
      />
    );
  }
  if (tab.kind === "editor" || tab.kind === "markdown") {
    const url = fileIconUrl(tab.title);
    return url ? <img src={url} alt="" className="size-3.5 shrink-0" /> : null;
  }
  if (tab.kind === "preview") {
    return (
      <HugeiconsIcon
        icon={Globe02Icon}
        size={14}
        strokeWidth={2}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "ai-diff") {
    return (
      <HugeiconsIcon
        icon={GitCompareIcon}
        size={14}
        strokeWidth={2}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "terminal" && tab.private) {
    return (
      <HugeiconsIcon
        icon={IncognitoIcon}
        size={14}
        strokeWidth={2}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "git-diff" || tab.kind === "git-commit-file") {
    return (
      <HugeiconsIcon
        icon={GitCompareIcon}
        size={14}
        strokeWidth={2}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "git-history") {
    return (
      <HugeiconsIcon
        icon={Clock01Icon}
        size={14}
        strokeWidth={2}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "architecture") {
    return (
      <HugeiconsIcon
        icon={CanvasIcon}
        size={14}
        strokeWidth={2}
        className="shrink-0"
      />
    );
  }
  if (tab.kind === "agent-chat") {
    return <HugeiconsIcon icon={AiChat01Icon} size={14} strokeWidth={2} className="shrink-0" />;
  }
  return (
    <HugeiconsIcon
      icon={ComputerTerminal02Icon}
      size={14}
      strokeWidth={2}
      className="shrink-0"
    />
  );
}

function labelFor(t: Tab): string {
  if (t.kind === "editor") return t.title;
  if (t.kind === "preview") return t.title;
  if (t.kind === "markdown") return t.title;
  if (t.kind === "ai-diff") return t.title;
  if (t.kind === "git-diff") return t.title;
  if (t.kind === "git-history") return t.title;
  if (t.kind === "architecture") return t.title;
  if (t.kind === "agent-chat") return t.title;
  if (t.kind === "git-commit-file") return t.title;
  if (t.kind === "terminal" && t.title !== "shell" && t.title !== "workspace") {
    return t.title;
  }
  if (!t.cwd) return t.title;
  const parts = t.cwd.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "/";
}
