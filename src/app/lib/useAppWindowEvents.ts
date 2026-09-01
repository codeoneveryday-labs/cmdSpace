import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

export function useAppWindowEvents({
  onNewTab,
  onOpenShortcuts,
  onMaximizePane,
}: {
  onNewTab: () => void;
  onOpenShortcuts: () => void;
  onMaximizePane: () => void;
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
}
