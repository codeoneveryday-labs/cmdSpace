import { useState } from "react";
import type { AgentChatModelOption } from "@/modules/ai/lib/agentChatRuntime";
import {
  ArrowDown01Icon,
  Brain02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function AgentSlashOptionPicker({
  options,
  selected,
  onSelect,
  onOpen,
  emptyLabel,
  loading,
  ariaLabel,
  icon,
}: {
  options: AgentChatModelOption[];
  selected: string;
  onSelect: (value: string) => void;
  onOpen: () => void;
  emptyLabel: string;
  loading: boolean;
  ariaLabel: string;
  icon?: typeof Brain02Icon;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.id === selected)
    ?? (selected ? { id: selected, label: selected } : undefined)
    ?? options[0]
    ?? { id: "", label: loading ? "Loading…" : emptyLabel };
  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) onOpen(); }}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground" aria-label={ariaLabel}>
          {icon ? <HugeiconsIcon icon={icon} size={17} strokeWidth={1.8} /> : null}
          <span className="font-medium">{current.label}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 gap-0 rounded-2xl p-1">
        {options.length === 0 ? <div className="px-3 py-2.5 text-xs text-muted-foreground">{loading ? "Loading options…" : "No options returned by this CLI"}</div> : options.map((option) => (
          <button key={option.id} type="button" onClick={() => { onSelect(option.id); setOpen(false); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-foreground/[0.07]">
            <span className="truncate">{option.label}</span>
            {option.id === current.id ? <HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2} /> : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
