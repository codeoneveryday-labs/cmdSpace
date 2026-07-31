import { cn } from "@/lib/utils";
import { EditorPane, type EditorPaneHandle } from "@/modules/editor/EditorPane";
import type { MarkdownTab, Tab } from "@/modules/tabs";
import {
  PencilEdit02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState } from "react";
import { MarkdownPreviewPane } from "./MarkdownPreviewPane";

type Props = {
  tabs: Tab[];
  activeId: number;
};

export function MarkdownStack({ tabs, activeId }: Props) {
  const markdowns = tabs.filter((t): t is MarkdownTab => t.kind === "markdown");
  const [modes, setModes] = useState<Record<number, "editor" | "preview">>(
    {},
  );
  const editorRefs = useRef(new Map<number, EditorPaneHandle>());
  const editorRefCallbacks = useRef(
    new Map<number, (handle: EditorPaneHandle | null) => void>(),
  );
  const getEditorRef = (id: number) => {
    let callback = editorRefCallbacks.current.get(id);
    if (!callback) {
      callback = (handle: EditorPaneHandle | null) => {
        if (handle) editorRefs.current.set(id, handle);
        else editorRefs.current.delete(id);
      };
      editorRefCallbacks.current.set(id, callback);
    }
    return callback;
  };
  if (markdowns.length === 0) return null;
  return (
    <div className="relative h-full w-full">
      {markdowns.map((t) => {
        const visible = t.id === activeId;
        const mode = modes[t.id] ?? "preview";
        const setMode = async (next: "editor" | "preview") => {
          if (next === "preview") {
            await editorRefs.current.get(t.id)?.save();
          }
          setModes((current) => ({ ...current, [t.id]: next }));
        };
        return (
          <div
            key={t.id}
            className={cn(
              "absolute inset-0 flex flex-col overflow-hidden rounded-md border border-border/60 bg-background",
              !visible && "invisible pointer-events-none",
            )}
            aria-hidden={!visible}
          >
            <div className="flex h-9 shrink-0 items-center justify-end border-b border-border/60 bg-card/70 px-2">
              <div
                aria-label="Markdown view mode"
                className="flex items-center gap-0.5 rounded-md border border-border/60 bg-background/70 p-0.5"
                role="group"
              >
                <button
                  type="button"
                  aria-label="Edit Markdown"
                  aria-pressed={mode === "editor"}
                  title="Edit Markdown"
                  onClick={() => void setMode("editor")}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded px-2 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    mode === "editor"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <HugeiconsIcon icon={PencilEdit02Icon} size={13} strokeWidth={1.8} />
                  Editor
                </button>
                <button
                  type="button"
                  aria-label="Preview Markdown"
                  aria-pressed={mode === "preview"}
                  title="Preview Markdown"
                  onClick={() => void setMode("preview")}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded px-2 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    mode === "preview"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <HugeiconsIcon icon={ViewIcon} size={13} strokeWidth={1.8} />
                  Preview
                </button>
              </div>
            </div>
            <div className="relative min-h-0 flex-1">
              <div
                className={cn(
                  "absolute inset-0",
                  mode !== "editor" && "invisible pointer-events-none",
                )}
                aria-hidden={mode !== "editor"}
              >
                <EditorPane ref={getEditorRef(t.id)} path={t.path} />
              </div>
              <div
                className={cn(
                  "absolute inset-0",
                  mode !== "preview" && "invisible pointer-events-none",
                )}
                aria-hidden={mode !== "preview"}
              >
                <MarkdownPreviewPane path={t.path} visible={visible && mode === "preview"} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
