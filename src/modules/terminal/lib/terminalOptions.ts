import { detectMonoFontFamily } from "@/lib/fonts";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { buildTerminalTheme } from "@/styles/terminalTheme";

export const TERMINAL_ZOOM_MIN = 0.25;

export function currentTerminalZoomLevel(): number {
  return Math.max(
    TERMINAL_ZOOM_MIN,
    usePreferencesStore.getState().zoomLevel || 1,
  );
}

export function effectiveTerminalFontSize(
  fontSize: number,
  zoomLevel = currentTerminalZoomLevel(),
): number {
  return Math.max(4, Math.round(fontSize * zoomLevel));
}

export function sharedTerminalOptions() {
  const preferences = usePreferencesStore.getState();
  return {
    fontFamily: preferences.terminalFontFamily || detectMonoFontFamily(),
    letterSpacing: preferences.terminalLetterSpacing,
    fontSize: effectiveTerminalFontSize(preferences.terminalFontSize),
    theme: buildTerminalTheme(),
    cursorBlink: false,
    cursorStyle: "bar" as const,
    cursorInactiveStyle: "bar" as const,
    scrollback: preferences.terminalScrollback,
    allowProposedApi: true,
    minimumContrastRatio:
      preferences.backgroundKind === "image" && preferences.backgroundImageId
        ? 4.5
        : 1,
  };
}
