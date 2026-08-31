import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ArrowRight01Icon,
  Folder01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dispatch, SetStateAction } from "react";
import type { CliAgentDefinition } from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceItem, WorkspaceMode } from "./WorkspacesPanel";
import {
  WorkspaceColorPicker,
  normalizeWorkspaceAccentColor,
} from "./WorkspaceRowPrimitives";
import {
  TERMINAL_COUNTS,
  WORKSPACE_SETUP_PRESETS,
  coerceTerminalCount,
  recentWorkspaceFolderLabel,
  resolveFolderCommand,
} from "./lib/workspaceSetupModel";

function TerminalLayoutGlyph({
  count,
}: {
  count: (typeof TERMINAL_COUNTS)[number];
}) {
  const cells = Math.min(count, 12);
  const cols = terminalGridColumns(count);
  return (
    <span
      className="grid gap-0.5 text-primary/70"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        width: Math.min(34, cols * 7),
      }}
      aria-hidden="true"
    >
      {Array.from({ length: cells }).map((_, index) => (
        <span
          key={index}
          className="size-1.5 rounded-[2px] bg-current"
        />
      ))}
    </span>
  );
}

function terminalGridColumns(count: number): number {
  if (count <= 1) return 1;
  if (count <= 10) return 2;
  return 3;
}

function layoutLabel(count: number): string {
  if (count === 1) return "1 x 1 grid";
  if (count === 2) return "2 x 1 grid";
  if (count === 4) return "2 x 2 grid";
  if (count === 6) return "2 x 3 grid";
  if (count === 8) return "2 x 4 grid";
  if (count === 10) return "2 x 5 grid";
  return "3 x 4 grid";
}

export function WorkspaceSetupLayoutStep({
  workspaceName,
  suggestedWorkspaceName,
  workspaceColor,
  suggestedWorkspaceColor,
  setWorkspaceName,
  setWorkspaceColor,
  workspaceMode,
  setWorkspaceMode,
  agentChatAgents,
  setTerminalCount,
  terminalCount,
  selectedFolder,
  setSelectedFolder,
  folderCommand,
  setFolderCommand,
  handleBrowse,
  handleApplyFolderCommand,
  recentFolders,
  setAgentCounts,
}: {
  workspaceName: string;
  suggestedWorkspaceName: string;
  workspaceColor: string;
  suggestedWorkspaceColor: string;
  setWorkspaceName: Dispatch<SetStateAction<string>>;
  setWorkspaceColor: Dispatch<SetStateAction<string>>;
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: Dispatch<SetStateAction<WorkspaceMode>>;
  agentChatAgents: CliAgentDefinition[];
  setTerminalCount: Dispatch<SetStateAction<(typeof TERMINAL_COUNTS)[number]>>;
  terminalCount: (typeof TERMINAL_COUNTS)[number];
  selectedFolder: string;
  setSelectedFolder: Dispatch<SetStateAction<string>>;
  folderCommand: string;
  setFolderCommand: Dispatch<SetStateAction<string>>;
  handleBrowse: () => void;
  handleApplyFolderCommand: () => void;
  recentFolders: WorkspaceItem[];
  setAgentCounts: Dispatch<SetStateAction<Record<string, number>>>;
}) {
  return (

            <>
              <section className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Workspace name
                  </h3>
                  <span className="text-[11px] text-muted-foreground/70">
                    Shown in the workspace list and tab
                  </span>
                </div>
                <div className="flex h-11 min-w-0 items-center rounded-lg border border-border/50 bg-card/40 px-3 transition-colors focus-within:border-border/80 focus-within:bg-card/60">
                  <WorkspaceColorPicker
                    workspaceName={workspaceName || suggestedWorkspaceName}
                    accentColor={workspaceColor}
                    onColorChange={setWorkspaceColor}
                  />
                  <Input
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    onBlur={() => {
                      if (workspaceName.trim().length === 0) {
                        setWorkspaceName(suggestedWorkspaceName);
                      }
                    }}
                    placeholder={suggestedWorkspaceName}
                    className="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent px-1 text-sm font-semibold text-foreground shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-0"
                    aria-label="Workspace name"
                  />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Workspace mode
                  </h3>
                  <span className="text-[11px] text-muted-foreground/70">
                    Choose a terminal, canvas, or standalone chat surface
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      mode: "standard" as const,
                      name: "Standard workspace",
                      description: "Your regular terminal workspace",
                    },
                    {
                      mode: "canvas" as const,
                      name: "Canvas workspace",
                      description: "The same workspace, plus a canvas tab",
                    },
                    {
                      mode: "agent" as const,
                      name: "Agent chat workspace",
                      description: "A calm agent timeline over your terminals",
                    },
                  ].map((option) => {
                    const selected = workspaceMode === option.mode;
                    return (
                      <button
                        key={option.mode}
                        type="button"
                        onClick={() => {
                          setWorkspaceMode(option.mode);
                          if (option.mode === "agent") {
                            setTerminalCount(12);
                            setAgentCounts((current) =>
                              Object.fromEntries(
                                Object.entries(current).filter(([id]) =>
                                  agentChatAgents.some((agent) => agent.id === id),
                                ),
                              ),
                            );
                          }
                        }}
                        aria-pressed={selected}
                        className={cn(
                          "flex min-h-16 items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          selected
                            ? "border-primary/60 bg-primary/[0.08] shadow-sm"
                            : "border-border/50 bg-card/40 hover:border-border/80 hover:bg-card/60",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-1 size-3 shrink-0 rounded-full border",
                            selected
                              ? "border-primary bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.14)]"
                              : "border-muted-foreground/40",
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">
                            {option.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Working folder
                  </h3>
                  <span className="text-[11px] text-muted-foreground/70">
                    Where your terminals will start
                  </span>
                </div>
                <div
                  onClick={handleBrowse}
                  className="flex h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-3 transition-colors hover:border-border/80 hover:bg-card/60"
                >
                  <HugeiconsIcon
                    icon={Folder01Icon}
                    size={16}
                    strokeWidth={1.75}
                    className="shrink-0 text-muted-foreground"
                  />
                  <Input
                    value={selectedFolder}
                    readOnly
                    placeholder="Select a working folder"
                    className="h-9 min-w-0 flex-1 cursor-pointer rounded-none border-0 bg-transparent px-1 font-mono text-sm text-foreground shadow-none focus-visible:ring-0"
                    aria-label="Working folder"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBrowse();
                    }}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                    aria-label="Browse folders"
                    title="Browse folders"
                  >
                    <HugeiconsIcon
                      icon={Search01Icon}
                      size={15}
                      strokeWidth={2}
                    />
                  </button>
                </div>
                <div className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border/45 bg-muted/30 px-3 font-mono text-sm shadow-inner">
                  <span className="shrink-0 text-muted-foreground/70">
                    &gt;
                  </span>
                  <Input
                    value={folderCommand}
                    onChange={(event) => setFolderCommand(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleApplyFolderCommand();
                      }
                    }}
                    placeholder="cd folder-name"
                    className="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 font-mono text-sm text-foreground shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-0"
                    aria-label="Change working folder command"
                  />
                  <button
                    type="button"
                    onClick={handleApplyFolderCommand}
                    disabled={
                      !resolveFolderCommand(folderCommand, selectedFolder)
                    }
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
                    aria-label="Apply working folder command"
                    title="Apply working folder command"
                  >
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={15}
                      strokeWidth={2}
                    />
                  </button>
                </div>
                {recentFolders.length > 0 ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          Recents
                        </h3>
                        <span className="text-[11px] font-medium text-muted-foreground/70">
                          {recentFolders.length}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground/80">
                        Last opened workspaces
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {recentFolders.map((workspace) => {
                        const folder = workspace.workingFolder ?? "";
                        return (
                          <button
                            key={workspace.id}
                            type="button"
                            onClick={() => {
                              setWorkspaceName(workspace.name);
                              setWorkspaceColor(
                                normalizeWorkspaceAccentColor(
                                  workspace.accentColor,
                                  suggestedWorkspaceColor,
                                ),
                              );
                              setSelectedFolder(folder);
                              setTerminalCount(
                                coerceTerminalCount(workspace.count),
                              );
                            }}
                            className="group flex min-w-0 items-center gap-3 rounded-lg border border-border/55 bg-card/45 px-3 py-2 text-left transition-colors hover:border-border/85 hover:bg-card/70"
                          >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/45 text-muted-foreground transition-colors group-hover:text-foreground">
                              <HugeiconsIcon
                                icon={Folder01Icon}
                                size={16}
                                strokeWidth={1.75}
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-foreground">
                                {workspace.name}
                              </span>
                              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                                {recentWorkspaceFolderLabel(folder)}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                              {workspace.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>

              {workspaceMode !== "agent" ? (
                <>
              <section className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Presets
                  </h3>
                  <span className="text-[11px] font-medium text-muted-foreground/70">
                    {WORKSPACE_SETUP_PRESETS.length}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {WORKSPACE_SETUP_PRESETS.map((preset) => {
                    const selected = preset.count === terminalCount;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setTerminalCount(preset.count)}
                        className={cn(
                          "group flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                          selected
                            ? "border-primary/65 bg-primary/10 text-foreground"
                            : "border-border/50 bg-card/35 text-muted-foreground hover:border-border/80 hover:bg-card/60 hover:text-foreground",
                        )}
                        aria-pressed={selected}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/45 text-primary/70 transition-colors group-hover:text-primary">
                          <TerminalLayoutGlyph count={preset.count} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {preset.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {preset.description}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                          {preset.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      How many terminals?
                    </h3>
                    <span className="text-[11px] text-muted-foreground/70">
                      Tap a tile to choose a layout
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-medium sm:flex sm:gap-4 md:text-right">
                    <span className="text-primary">
                      {terminalCount} terminal
                    </span>
                    <span className="text-muted-foreground">
                      {layoutLabel(terminalCount)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(72px,1fr))] gap-3">
                  {TERMINAL_COUNTS.map((count) => {
                    const selected = count === terminalCount;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setTerminalCount(count)}
                        className={cn(
                          "flex h-18 min-w-0 flex-col items-center justify-center gap-2 rounded-lg border bg-card/20 text-sm font-semibold transition-colors sm:h-20",
                          selected
                            ? "border-primary/70 bg-primary/10 text-foreground shadow-[0_0_0_1px_rgba(59,130,246,0.28),0_0_24px_rgba(59,130,246,0.18)]"
                            : "border-border/40 text-muted-foreground hover:border-border hover:bg-card/50 hover:text-foreground",
                        )}
                        aria-pressed={selected}
                      >
                        <TerminalLayoutGlyph count={count} />
                        <span>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
                </>
              ) : null}
            </>
  );
}
