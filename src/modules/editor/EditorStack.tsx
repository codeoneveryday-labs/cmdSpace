import { cn } from "@/lib/utils";
import { MarkdownPreviewPane } from "@/modules/markdown/MarkdownPreviewPane";
import type { EditorTab, Tab } from "@/modules/tabs";
import { PencilEdit02Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { EditorPane, type EditorPaneHandle } from "./EditorPane";

type Props = {
  tabs: Tab[];
  activeId: number;
  onDirtyChange: (id: number, dirty: boolean) => void;
  registerHandle: (id: number, handle: EditorPaneHandle | null) => void;
  onCloseTab: (id: number) => void;
};

export function EditorStack({
  tabs,
  activeId,
  onDirtyChange,
  registerHandle,
  onCloseTab,
}: Props) {
  const editors = tabs.filter((t): t is EditorTab => t.kind === "editor");
  const [markdownModes, setMarkdownModes] = useState<
    Record<number, "editor" | "preview">
  >({});

  // Stable per-tab callbacks. Inline arrows in `ref` and `onDirtyChange`
  // change identity every render, which makes React detach+reattach the ref
  // callback and re-invoke `onDirtyChange`, triggering setState loops in
  // the parent. Memoizing per id keeps each callback's identity stable.
  const registerRef = useRef(registerHandle);
  const dirtyRef = useRef(onDirtyChange);
  const closeRef = useRef(onCloseTab);
  useEffect(() => {
    registerRef.current = registerHandle;
  }, [registerHandle]);
  useEffect(() => {
    dirtyRef.current = onDirtyChange;
  }, [onDirtyChange]);
  useEffect(() => {
    closeRef.current = onCloseTab;
  }, [onCloseTab]);

  const refCallbacks = useRef(
    new Map<number, (h: EditorPaneHandle | null) => void>(),
  );
  const editorHandles = useRef(new Map<number, EditorPaneHandle>());
  const dirtyCallbacks = useRef(new Map<number, (dirty: boolean) => void>());
  const closeCallbacks = useRef(new Map<number, () => void>());

  const getRefCallback = (id: number) => {
    let cb = refCallbacks.current.get(id);
    if (!cb) {
      cb = (h: EditorPaneHandle | null) => {
        if (h) editorHandles.current.set(id, h);
        else editorHandles.current.delete(id);
        registerRef.current(id, h);
      };
      refCallbacks.current.set(id, cb);
    }
    return cb;
  };
  const getDirtyCallback = (id: number) => {
    let cb = dirtyCallbacks.current.get(id);
    if (!cb) {
      cb = (dirty: boolean) => dirtyRef.current(id, dirty);
      dirtyCallbacks.current.set(id, cb);
    }
    return cb;
  };
  const getCloseCallback = (id: number) => {
    let cb = closeCallbacks.current.get(id);
    if (!cb) {
      cb = () => closeRef.current(id);
      closeCallbacks.current.set(id, cb);
    }
    return cb;
  };

  // Drop callback entries for closed tabs to avoid unbounded growth.
  useEffect(() => {
    const live = new Set(editors.map((t) => t.id));
    for (const id of refCallbacks.current.keys()) {
      if (!live.has(id)) refCallbacks.current.delete(id);
    }
    for (const id of dirtyCallbacks.current.keys()) {
      if (!live.has(id)) dirtyCallbacks.current.delete(id);
    }
    for (const id of closeCallbacks.current.keys()) {
      if (!live.has(id)) closeCallbacks.current.delete(id);
    }
    for (const id of editorHandles.current.keys()) {
      if (!live.has(id)) editorHandles.current.delete(id);
    }
  }, [editors]);

  if (editors.length === 0) return null;
  return (
    <div className="relative h-full w-full">
      {editors.map((t) => {
        const visible = t.id === activeId;
        const isMarkdown = /\.(md|markdown)$/i.test(t.path);
        const mode = markdownModes[t.id] ?? "editor";
        const setMode = async (next: "editor" | "preview") => {
          if (next === "preview") {
            await editorHandles.current.get(t.id)?.save();
          }
          setMarkdownModes((current) => ({ ...current, [t.id]: next }));
        };
        return (
          <div
            key={t.id}
            className={cn(
              "absolute inset-0",
              !visible && "invisible pointer-events-none",
            )}
            aria-hidden={!visible}
          >
            <div className="h-full overflow-hidden rounded-md border border-border/60 bg-background">
              {isMarkdown ? (
                <div className="flex h-full min-h-0 flex-col">
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
                      <EditorPane
                        ref={getRefCallback(t.id)}
                        path={t.path}
                        onDirtyChange={getDirtyCallback(t.id)}
                        onClose={getCloseCallback(t.id)}
                      />
                    </div>
                    <div
                      className={cn(
                        "absolute inset-0",
                        mode !== "preview" && "invisible pointer-events-none",
                      )}
                      aria-hidden={mode !== "preview"}
                    >
                      <MarkdownPreviewPane
                        path={t.path}
                        visible={visible && mode === "preview"}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <EditorPane
                  ref={getRefCallback(t.id)}
                  path={t.path}
                  onDirtyChange={getDirtyCallback(t.id)}
                  onClose={getCloseCallback(t.id)}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
