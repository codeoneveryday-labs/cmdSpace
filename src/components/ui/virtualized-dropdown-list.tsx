import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type VirtualizedDropdownListProps<T> = {
  items: T[];
  itemHeight?: number;
  maxVisibleItems?: number;
  overscan?: number;
  className?: string;
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
};

export function VirtualizedDropdownList<T>({
  items,
  itemHeight = 36,
  maxVisibleItems = 8,
  overscan = 4,
  className,
  keyExtractor,
  renderItem,
}: VirtualizedDropdownListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportHeight = Math.min(items.length, maxVisibleItems) * itemHeight;
  const totalHeight = items.length * itemHeight;

  const { visibleItems, offsetY } = useMemo(() => {
    const firstVisibleIndex = Math.max(
      0,
      Math.floor(scrollTop / itemHeight) - overscan,
    );
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2;
    const lastVisibleIndex = Math.min(
      items.length,
      firstVisibleIndex + visibleCount,
    );

    return {
      offsetY: firstVisibleIndex * itemHeight,
      visibleItems: items.slice(firstVisibleIndex, lastVisibleIndex).map(
        (item, localIndex) => ({
          item,
          index: firstVisibleIndex + localIndex,
        }),
      ),
    };
  }, [itemHeight, items, overscan, scrollTop, viewportHeight]);

  if (items.length === 0) return null;

  return (
    <div
      className={cn("overflow-y-scroll", className)}
      style={{ height: viewportHeight }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetY}px)`,
          }}
        >
          {visibleItems.map(({ item, index }) => (
            <div
              key={keyExtractor(item, index)}
              style={{ height: itemHeight }}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
