import { LockIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function NodeLockBadge({ x, y }: { x: number | string; y: number | string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="10" className="fill-background stroke-amber-500" />
      <HugeiconsIcon
        icon={LockIcon}
        size={12}
        x={-6}
        y={-6}
        className="text-amber-500"
      />
    </g>
  );
}
