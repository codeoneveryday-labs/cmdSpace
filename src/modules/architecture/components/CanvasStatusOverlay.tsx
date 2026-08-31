import { Button } from "@/components/ui/button";
import { CanvasFocusIcon } from "./CanvasFocusIcon";

export function CanvasStatusOverlay({
  nodeCount,
  edgeCount,
  zoom,
  canvasFocused,
  onToggleCanvasFocus,
}: {
  nodeCount: number;
  edgeCount: number;
  zoom: number;
  canvasFocused: boolean;
  onToggleCanvasFocus?: () => void;
}) {
  return (
    <>
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-border/70 bg-background/85 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
        <span>{nodeCount} shapes</span>
        <span className="h-3 w-px bg-border" />
        <span>{edgeCount} connections</span>
        <span className="h-3 w-px bg-border" />
        <span>{Math.round(zoom * 100)}%</span>
      </div>

      {onToggleCanvasFocus ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute bottom-3 right-3 z-30 size-11 rounded-full border border-border/70 bg-background/90 text-muted-foreground shadow-sm backdrop-blur hover:bg-background hover:text-foreground"
          onClick={onToggleCanvasFocus}
          title={canvasFocused ? "Restore canvas sidebars" : "Focus canvas"}
          aria-label={canvasFocused ? "Restore canvas sidebars" : "Focus canvas"}
          aria-pressed={canvasFocused}
        >
          <CanvasFocusIcon focused={canvasFocused} />
        </Button>
      ) : null}
    </>
  );
}
