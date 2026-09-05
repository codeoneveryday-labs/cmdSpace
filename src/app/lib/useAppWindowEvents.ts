import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";

export function useAppWindowEvents({
  onNewTab,
  onOpenShortcuts,
  onMaximizePane,
  onOpenFile,
  onBeforeClose,
}: {
  onNewTab: () => void;
  onOpenShortcuts: () => void;
  onMaximizePane: () => void;
  onOpenFile: (path: string) => void;
  onBeforeClose?: () => void | Promise<void>;
}): void {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const drainOpenFiles = async () => {
      const paths = await invoke<string[]>("drain_open_files");
      if (!disposed) paths.forEach(onOpenFile);
    };
    void listen("cmdspace:open-files", () => void drainOpenFiles()).then(
      (dispose) => {
        if (disposed) dispose();
        else {
          unlisten = dispose;
          void drainOpenFiles();
        }
      },
    );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onOpenFile]);

  useEffect(() => {
    const unlisten = listen("cmdspace:new-tab", onNewTab);
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [onNewTab]);

  useEffect(() => {
    const unlisten = listen("cmdspace:open-shortcuts", onOpenShortcuts);
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [onOpenShortcuts]);

  useEffect(() => {
    const unlisten = listen("cmdspace:maximize-pane", onMaximizePane);
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [onMaximizePane]);

  useEffect(() => {
    if (!onBeforeClose) return;
    const unlisten = listen("cmdspace:exit-requested", () => {
      void Promise.resolve(onBeforeClose())
        .catch((error: unknown) => {
          console.error("Failed during app exit flush:", error);
        })
        .finally(() => {
          void invoke("app_exit_flush_complete").catch((error: unknown) => {
            console.error("Failed to acknowledge app exit flush:", error);
          });
        });
    });
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [onBeforeClose]);
}
