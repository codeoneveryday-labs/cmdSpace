import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Cursor01Icon } from "@hugeicons/core-free-icons";

export function ToolButton({
  active = false,
  disabled = false,
  icon,
  iconNode,
  label,
  onClick,
  shortcut,
}: {
  active?: boolean;
  disabled?: boolean;
  icon?: typeof Cursor01Icon;
  iconNode?: ReactNode;
  label: string;
  onClick: () => void;
  shortcut?: string;
}) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "h-11 w-11 shrink-0 rounded-full border border-transparent text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
        active && "border-zinc-200 bg-zinc-200/90 text-zinc-950 shadow-sm hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-800",
      )}
    >
      {iconNode ?? (icon ? <HugeiconsIcon icon={icon} size={18} /> : null)}
    </Button>
  );
}
