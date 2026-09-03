import { useCallback, useEffect, useState, type MouseEvent } from "react";
import {
  ArrowDown01Icon,
  FlashIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CliAgent } from "./lib/cliAgents";
import {
  getCliAgentControlProfile,
  detectAgentFastMode,
  handleAgentFastModeFallback,
  executeAgentCommand,
  type AgentPermissionOption,
} from "./lib/cliAgentControls";

export type TerminalAgentPermissionPillProps = {
  agent?: CliAgent | null;
  onWrite?: (data: string) => void;
  onGetBuffer?: (lines?: number) => string | null;
  onFocusTerminal?: () => void;
  className?: string;
};

export function detectFastModeFromBuffer(
  buffer: string | null | undefined,
  agent: CliAgent = "claude",
): boolean | null {
  return (
    detectAgentFastMode(agent, buffer) ??
    detectAgentFastMode("codex", buffer) ??
    null
  );
}

export function TerminalAgentPermissionPill({
  agent,
  onWrite,
  onGetBuffer,
  onFocusTerminal,
  className,
}: TerminalAgentPermissionPillProps) {
  const profile = getCliAgentControlProfile(agent);
  const [fastMode, setFastMode] = useState(false);
  const [selectedPermissionId, setSelectedPermissionId] = useState<string>(
    profile.defaultPermissionId,
  );

  const refocusTerminal = useCallback(() => {
    onFocusTerminal?.();
    requestAnimationFrame(() => {
      if (onFocusTerminal) {
        onFocusTerminal();
      } else {
        const activeEl = document.querySelector<HTMLTextAreaElement>(
          ".cmdspace-terminal-viewport .xterm-helper-textarea, .xterm-helper-textarea",
        );
        activeEl?.focus();
      }
    });
  }, [onFocusTerminal]);

  // Synchronize active permission when agent changes
  useEffect(() => {
    setSelectedPermissionId(profile.defaultPermissionId);
    setFastMode(false);
  }, [agent, profile.defaultPermissionId]);

  // Synchronize fast mode with terminal buffer if available
  useEffect(() => {
    if (!onGetBuffer) return;
    const syncFastMode = () => {
      const buf = onGetBuffer(40);
      const detected = detectAgentFastMode(agent, buf);
      if (detected !== null) {
        setFastMode(detected);
      }
    };
    syncFastMode();
    const interval = window.setInterval(syncFastMode, 3000);
    return () => window.clearInterval(interval);
  }, [agent, onGetBuffer]);

  const activeOption =
    profile.permissions.find((opt) => opt.id === selectedPermissionId) ||
    profile.permissions[0];

  const handleToggleFastMode = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (profile.fastMode.command && onWrite) {
      executeAgentCommand(agent, profile.fastMode.command, onWrite);
    }

    refocusTerminal();

    if (!onGetBuffer) {
      setFastMode((prev) => !prev);
      return;
    }

    // Verify buffer after command execution
    const delays = [300, 700, 1200];
    delays.forEach((delay) => {
      window.setTimeout(() => {
        const buf = onGetBuffer(40);
        if (!buf) return;

        const detected = detectAgentFastMode(agent, buf);
        if (detected !== null) {
          setFastMode(detected);
        }

        // Delegate agent-specific failure fallback (e.g. Esc to dismiss error dialog)
        if (onWrite) {
          handleAgentFastModeFallback(agent, buf, onWrite);
        }
      }, delay);
    });
  };

  const handleSelectPermission = (option: AgentPermissionOption) => {
    setSelectedPermissionId(option.id);
    if (option.command && onWrite) {
      executeAgentCommand(agent, option.command, onWrite);
    }
    refocusTerminal();
  };

  const fastSupported = profile.fastMode.supported;

  return (
    <div
      className={cn(
        "flex items-center h-5.5 rounded border border-border/70 bg-muted/40 dark:bg-zinc-800/60 shadow-xs text-xs select-none transition-colors hover:border-border",
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Lightning bolt (Fast mode toggle) - only shown when supported by the agent */}
      {fastSupported ? (
        <>
          <button
            type="button"
            onClick={handleToggleFastMode}
            title={
              fastMode
                ? `${profile.fastMode.label || "Fast mode"} (enabled)`
                : profile.fastMode.label || "Toggle fast mode"
            }
            aria-pressed={fastMode}
            aria-label={profile.fastMode.label || "Toggle fast mode"}
            className={cn(
              "grid size-5.5 place-items-center rounded-l transition-colors cursor-pointer",
              fastMode
                ? "text-amber-500 hover:text-amber-400 bg-amber-500/15"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
            )}
          >
            <HugeiconsIcon icon={FlashIcon} size={13} strokeWidth={2} />
          </button>
          <span className="h-3 w-px bg-border/60" />
        </>
      ) : null}

      {/* Permission dropdown trigger */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center justify-between gap-1 px-1.5 py-0.5 text-[11px] font-mono font-medium text-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer min-w-[5.8rem]",
              fastSupported ? "rounded-r" : "rounded",
            )}
            title="Select permission mode"
            aria-label={`Permission mode: ${activeOption?.label || "Permission"}`}
          >
            <span className="truncate">{activeOption?.label || "Mode"}</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={10}
              strokeWidth={2.2}
              className="text-muted-foreground shrink-0"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            refocusTerminal();
          }}
          className="w-(--radix-dropdown-menu-trigger-width) min-w-(--radix-dropdown-menu-trigger-width) max-w-(--radix-dropdown-menu-trigger-width) p-0.5 rounded-md border border-border/70 shadow-md"
        >
          {profile.permissions.map((opt) => {
            const isSelected = opt.id === activeOption?.id;
            return (
              <DropdownMenuItem
                key={opt.id}
                onSelect={() => handleSelectPermission(opt)}
                className={cn(
                  "flex items-center justify-between px-1.5 py-0.5 rounded-sm cursor-pointer font-mono text-[11px]",
                  isSelected && "bg-muted font-semibold",
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected ? (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={11}
                    strokeWidth={2.2}
                    className="text-emerald-500 shrink-0 ml-1"
                  />
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
