import { useState } from "react";

export function AgentChatOutlineRail({
  prompts,
  activeIndex,
  onJump,
}: {
  prompts: Array<{ id: string; text: string }>;
  activeIndex: number | null;
  onJump: (id: string) => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  if (prompts.length < 2) return null;
  const attentionIndex = hoveredIndex;
  const slotHeight = Math.min(8, 640 / prompts.length);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 block" aria-label="Chat outline">
      <div className="pointer-events-auto absolute left-2 top-1/2 flex max-h-[80%] w-9 -translate-y-1/2 flex-col items-start justify-center pl-1">
        {prompts.map((prompt, index) => {
          const distance = attentionIndex === null ? 99 : Math.abs(index - attentionIndex);
          const magnification = distance >= 3 ? 0 : (1 + Math.cos((Math.PI * distance) / 3)) / 2;
          const active = index === activeIndex;
          const width = 10 + magnification * 16;
          const height = 2 + magnification * 2;
          const attention = index === attentionIndex;
          return (
            <div key={prompt.id} className="relative flex w-9 shrink-0 items-center justify-start" style={{ height: slotHeight }} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
              <button type="button" onClick={() => onJump(prompt.id)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} aria-label={`${index + 1} of ${prompts.length}: ${prompt.text}`} aria-current={active ? "true" : undefined} className="flex h-full w-full items-center justify-start rounded-sm pl-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                <span className={`block rounded-full transition-[width,height,background-color] duration-150 ease-out ${attention ? "bg-foreground" : active ? "bg-foreground/60" : "bg-border/70"}`} style={{ width, height }} />
              </button>
              {attention ? <span className="pointer-events-none absolute left-10 top-1/2 flex h-12 w-[260px] -translate-y-1/2 items-center rounded-lg border border-border bg-card px-3 text-xs text-foreground shadow-lg" aria-hidden="true">{prompt.text}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
