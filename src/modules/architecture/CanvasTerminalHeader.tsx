import { cn } from "@/lib/utils";
import {
  Add01Icon,
  Cancel01Icon,
  Globe02Icon,
  LockIcon,
  SquareUnlock01Icon,
  TerminalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import { AgentStateDot } from "@/modules/terminal/AgentStateDot";
import { TerminalAgentSwitcher } from "@/modules/terminal/TerminalAgentSwitcher";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";

type StackTab = {
  id: string;
  label: string;
  kind?: "terminal" | "browser";
  agent?: CliAgent | null;
};

export function CanvasTerminalHeader({
  stackTabs,
  activeTabId,
  tabLabel,
  detectedAgent,
  agentResponseState,
  onActivateTab,
  onTabPointerDown,
  onRequestCloseTab,
  onAgentCommandChange,
  onAddTab,
  onSplitRight,
  singleTerminalGroup,
  terminalGroupLocked,
  maximized,
  onToggleTerminalGroupLock,
  onToggleTerminalGroupMaximize,
  onRequestCloseTerminalGroup,
}: {
  stackTabs: StackTab[];
  activeTabId: string;
  tabLabel: string;
  detectedAgent: CliAgent | null;
  agentResponseState: "idle" | "responding" | "completed";
  onActivateTab: (terminalId: string) => void;
  onTabPointerDown: (terminalId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onRequestCloseTab: (terminalId: string) => void;
  onAgentCommandChange: (command: string) => void;
  onAddTab: (initialCommand?: string) => void;
  onSplitRight: () => void;
  singleTerminalGroup: boolean;
  terminalGroupLocked: boolean;
  maximized: boolean;
  onToggleTerminalGroupLock: () => void;
  onToggleTerminalGroupMaximize: () => void;
  onRequestCloseTerminalGroup: () => void;
}) {
  return (
    <div className="relative z-20 flex h-7 shrink-0 items-center gap-0.5 border-b border-border/60 bg-white/95 px-1 text-muted-foreground shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-300">
      <div role="tablist" aria-label="Canvas terminal tabs" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {stackTabs.map((tab) => {
          const tabAgent = tab.id === activeTabId ? detectedAgent ?? tab.agent : tab.agent;
          return (
            <div key={tab.id} data-canvas-surface-tab-kind={tab.kind} className={cn("flex max-w-52 shrink-0 items-center rounded-full py-0.5 pr-1 text-[11px] font-normal transition-colors", tab.id === activeTabId ? "bg-muted text-foreground shadow-sm dark:bg-zinc-800 dark:text-zinc-100" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:hover:bg-zinc-800/70")}>
              <button type="button" role="tab" aria-selected={tab.id === activeTabId} className="flex min-w-0 items-center gap-1 px-2" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onActivateTab(tab.id); onTabPointerDown(tab.id, event); }} onClick={(event) => { event.stopPropagation(); onActivateTab(tab.id); }}>
                {tab.kind === "browser" ? <HugeiconsIcon icon={Globe02Icon} size={12} strokeWidth={1.8} className="shrink-0" /> : tab.id === activeTabId ? <TerminalAgentSwitcher currentAgent={tabAgent ?? null} onSelect={(_agent, command) => { if (command) onAgentCommandChange(command); }} trigger={<span className="inline-flex shrink-0 cursor-pointer" aria-label="Switch coding agent" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>{tabAgent ? <AgentCliIcon agent={tabAgent} size="sm" /> : <HugeiconsIcon icon={TerminalIcon} size={12} strokeWidth={1.8} />}</span>} /> : tabAgent ? <AgentCliIcon agent={tabAgent} size="sm" /> : <HugeiconsIcon icon={TerminalIcon} size={12} strokeWidth={1.8} className="shrink-0" />}
                <span className="truncate">{tab.id === activeTabId ? tabLabel : tab.label}</span>
              </button>
              <button type="button" aria-label={`Close ${tab.label}`} title={`Close ${tab.label}`} className="grid size-4 shrink-0 place-items-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={(event) => { event.stopPropagation(); onRequestCloseTab(tab.id); }}><HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={1.8} /></button>
            </div>
          );
        })}
      </div>
      {agentResponseState === "responding" ? <AgentStateDot state="working" /> : null}
      {agentResponseState === "completed" ? <AgentStateDot state="done" /> : null}
      <div className="flex shrink-0 items-center gap-0.5">
        <TerminalAgentSwitcher currentAgent={null} onSelect={(_agent, command) => onAddTab(command ?? undefined)} trigger={<button type="button" aria-label="Add terminal tab" title="Add terminal tab or agent" className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white" onPointerDown={(event) => event.stopPropagation()}><HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.8} /></button>} />
        <button type="button" aria-label="Split terminal right" title="Split terminal right" className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={onSplitRight}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 4v16" /></svg></button>
        {singleTerminalGroup ? <>
          <button type="button" aria-label={terminalGroupLocked ? "Unlock terminal group" : "Lock terminal group"} title={terminalGroupLocked ? "Unlock terminal group" : "Lock terminal group"} className={cn("grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white", terminalGroupLocked && "text-primary hover:text-primary")} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={onToggleTerminalGroupLock}><HugeiconsIcon icon={terminalGroupLocked ? LockIcon : SquareUnlock01Icon} size={13} strokeWidth={1.8} /></button>
          <button type="button" aria-label={maximized ? "Restore terminal group" : "Maximize terminal group"} title={maximized ? "Restore terminal group" : "Maximize terminal group"} className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={onToggleTerminalGroupMaximize}>{maximized ? <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h6v6" /><path d="M10 14l-6 6" /><path d="M20 10h-6V4" /><path d="M14 10l6-6" /></svg> : <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>}</button>
          <button type="button" aria-label="Close terminal group" title="Close terminal group" className="grid size-5 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/[0.08] hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-zinc-400 dark:hover:bg-red-500/15 dark:hover:text-red-400" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={onRequestCloseTerminalGroup}><HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.8} /></button>
        </> : null}
      </div>
    </div>
  );
}
