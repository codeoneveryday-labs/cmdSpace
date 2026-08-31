import { useEffect } from "react";

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function useWorkspaceSetupKeyboardShortcuts({
  importSessionPickerOpen,
  onBack,
  onPrimaryAction,
}: {
  importSessionPickerOpen: boolean;
  onBack: () => void;
  onPrimaryAction: () => void;
}) {
  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (importSessionPickerOpen) return;
      if (event.defaultPrevented || isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onBack();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        onPrimaryAction();
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [importSessionPickerOpen, onBack, onPrimaryAction]);
}
