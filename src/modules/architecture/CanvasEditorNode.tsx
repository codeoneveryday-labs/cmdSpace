import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EditorPane, type EditorPaneHandle } from "@/modules/editor";
import {
  Cancel01Icon,
  FileEditIcon,
  LockIcon,
  SquareUnlock01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Props = {
  path?: string;
  active: boolean;
  locked: boolean;
  interactionBlocked?: boolean;
  onPathChange: (path: string) => void;
  onActivate: () => void;
  onHeaderPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleLock: () => void;
  onRequestClose: () => void;
};

export function CanvasEditorNode({
  path,
  locked,
  interactionBlocked = false,
  onPathChange,
  onActivate,
  onHeaderPointerDown,
  onToggleLock,
  onRequestClose,
}: Props) {
  const editorRef = useRef<EditorPaneHandle>(null);
  const [draftPath, setDraftPath] = useState(path ?? "");
  const [dirty, setDirty] = useState(false);

  const openPath = (event: FormEvent) => {
    event.preventDefault();
    const nextPath = draftPath.trim();
    if (nextPath) onPathChange(nextPath);
  };

  return (
    <div
      data-canvas-editor-node="true"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[12px] border border-border/70 bg-background shadow-[0_12px_32px_rgba(15,23,42,0.18)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.42)]"
      onPointerDown={onActivate}
    >
      <div
        className={cn(
          "flex h-8 shrink-0 cursor-grab items-center gap-2 border-b border-border/60 bg-card/95 px-2 active:cursor-grabbing",
          locked && "cursor-not-allowed active:cursor-not-allowed",
        )}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          onHeaderPointerDown(event);
        }}
      >
        <HugeiconsIcon icon={FileEditIcon} size={14} strokeWidth={1.8} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
          {canvasEditorTitle(path)}{dirty ? " •" : ""}
        </span>
        <button
          type="button"
          aria-label={locked ? "Unlock editor node" : "Lock editor node"}
          title={locked ? "Unlock editor node" : "Lock editor node"}
          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggleLock}
        >
          <HugeiconsIcon
            icon={locked ? LockIcon : SquareUnlock01Icon}
            size={13}
            strokeWidth={1.8}
          />
        </button>
        <button
          type="button"
          aria-label="Close editor node"
          title="Close editor node"
          disabled={locked}
          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onRequestClose}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.8} />
        </button>
      </div>
      <div
        className={cn(
          "relative min-h-0 flex-1",
          interactionBlocked && "pointer-events-none",
        )}
      >
        {path ? (
          <EditorPane
            ref={editorRef}
            path={path}
            onDirtyChange={setDirty}
            onSaved={() => setDirty(false)}
          />
        ) : (
          <form
            className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
            onSubmit={openPath}
          >
            <div className="grid size-12 place-items-center rounded-2xl border border-border/60 bg-card text-muted-foreground">
              <HugeiconsIcon icon={FileEditIcon} size={20} strokeWidth={1.6} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Open a file</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter an absolute path in this workspace.
              </p>
            </div>
            <div className="flex w-full max-w-md gap-2">
              <Input
                value={draftPath}
                placeholder="Enter a file path"
                aria-label="Editor file path"
                spellCheck={false}
                className="h-9 min-w-0 flex-1 font-mono text-xs"
                onChange={(event) => setDraftPath(event.target.value)}
              />
              <Button type="submit" size="sm" disabled={!draftPath.trim()}>
                Open file
              </Button>
            </div>
          </form>
        )}
        {interactionBlocked ? (
          <div className="absolute inset-0 z-10 cursor-grabbing" />
        ) : null}
      </div>
    </div>
  );
}

export function canvasEditorTitle(path?: string): string {
  if (!path) return "Editor";
  return path.split(/[\\/]/).filter(Boolean).pop() || "Editor";
}
