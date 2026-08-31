import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, type RefObject } from "react";

export function useFileExplorerNativeDrop({
  acceptExternalDrops,
  scrollRef,
  onDroppingChange,
  resolveDestination,
  importPaths,
}: {
  acceptExternalDrops: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onDroppingChange: (dropping: boolean) => void;
  resolveDestination: (targetPath?: string, targetIsDir?: boolean) => string;
  importPaths: (paths: string[], destination: string) => Promise<unknown>;
}) {
  useEffect(() => {
    if (!isTauri()) return;
    const appWindow = getCurrentWindow();
    const appWebview = getCurrentWebview();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const scaleFactor = await appWindow.scaleFactor();
      if (disposed) return;
      const stop = await appWebview.onDragDropEvent(({ payload }) => {
        if (disposed) return;
        if (payload.type === "leave") {
          onDroppingChange(false);
          return;
        }
        const position = payload.position.toLogical(scaleFactor);
        const pointTarget = document.elementFromPoint(position.x, position.y);
        const rect = scrollRef.current?.getBoundingClientRect();
        const overExplorer = Boolean(
          rect &&
            position.x >= rect.left &&
            position.x <= rect.right &&
            position.y >= rect.top &&
            position.y <= rect.bottom,
        );
        const overEditor = Boolean(
          acceptExternalDrops &&
            pointTarget?.closest("[data-editor-file-drop-region]"),
        );
        onDroppingChange(overExplorer);
        if (payload.type !== "drop" || !(overExplorer || overEditor)) return;

        onDroppingChange(false);
        const target = overExplorer
          ? pointTarget?.closest<HTMLElement>("[data-fs-path]")
          : null;
        const destination = resolveDestination(
          target?.dataset.fsPath,
          target?.dataset.fsIsDir === "true",
        );
        void importPaths(payload.paths, destination).catch((error) => {
          console.error("import dropped paths failed:", error);
        });
      });
      if (disposed) stop();
      else unlisten = stop;
    })().catch((error) => {
      console.error("register native file drop failed:", error);
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [acceptExternalDrops, importPaths, onDroppingChange, resolveDestination, scrollRef]);
}
