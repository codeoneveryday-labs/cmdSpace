import { cn } from "@/lib/utils";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function SkillsLauncher({
  compact = false,
  onOpenSkills,
}: {
  compact?: boolean;
  onOpenSkills: () => void;
}) {
  return (
    <div
      className={cn(
        "shrink-0 border-b border-border/60",
        compact ? "px-3 py-2" : "px-4 py-2",
      )}
    >
      <button
        type="button"
        onClick={onOpenSkills}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md bg-muted/65 px-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          compact && "justify-center px-2",
        )}
        aria-label="Open skills catalog"
        title="Skill & Plugin"
      >
        <HugeiconsIcon icon={SparklesIcon} size={16} strokeWidth={1.8} />
        <span className={cn("truncate", compact && "sr-only")}>
          Skill & Plugin
        </span>
      </button>
    </div>
  );
}
