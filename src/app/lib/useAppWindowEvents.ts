import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";

export function useAppWindowEvents({
  onNewTab,
  onOpenShortcuts,
  onMaximizePane,
  onBeforeClose,
}: {
  onNewTab: () => void;
  onOpenShortcuts: () => void;
  onMaximizePane: () => void;
  onBeforeClose?: () => void | Promise<void>;
}): void {
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
