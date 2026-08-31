import { usePreferencesStore } from "@/modules/settings/preferences";

type SelectionTerminal = {
  getSelection: () => string;
  clearSelection: () => void;
  onSelectionChange: (listener: () => void) => unknown;
};

export function installCanvasTerminalSelectionCopy(
  terminal: SelectionTerminal,
  copyText: (selection: string) => Promise<void>,
  onCopyBadgeChange: (visible: boolean) => void,
): () => void {
  let copyOnSelectionTimer: ReturnType<typeof setTimeout> | null = null;
  let copyBadgeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastAutoCopiedSelection = "";

  terminal.onSelectionChange(() => {
    if (copyOnSelectionTimer) clearTimeout(copyOnSelectionTimer);
    copyOnSelectionTimer = setTimeout(() => {
      copyOnSelectionTimer = null;
      if (!usePreferencesStore.getState().terminalCopyOnSelection) return;
      const selection = terminal.getSelection();
      if (!selection) {
        lastAutoCopiedSelection = "";
        return;
      }
      if (selection === lastAutoCopiedSelection) return;

      lastAutoCopiedSelection = selection;
      void copyText(selection)
        .then(() => {
          if (copyBadgeTimer) clearTimeout(copyBadgeTimer);
          onCopyBadgeChange(true);
          copyBadgeTimer = setTimeout(() => {
            copyBadgeTimer = null;
            onCopyBadgeChange(false);
          }, 1_200);
          terminal.clearSelection();
        })
        .catch(() => {
          lastAutoCopiedSelection = "";
        });
    }, 120);
  });

  return () => {
    if (copyOnSelectionTimer) clearTimeout(copyOnSelectionTimer);
    if (copyBadgeTimer) clearTimeout(copyBadgeTimer);
  };
}
