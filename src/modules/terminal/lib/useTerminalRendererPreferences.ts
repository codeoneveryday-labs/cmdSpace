import { useEffect } from "react";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  applyBackgroundActive,
  applyFontFamily,
  applyFontSize,
  applyLetterSpacing,
  applyScrollback,
  applyWebglPreference,
  applyZoomLevel,
} from "./rendererPool";

export function useTerminalRendererPreferences() {
  const fontSize = usePreferencesStore((state) => state.terminalFontSize);
  const fontFamily = usePreferencesStore((state) => state.terminalFontFamily);
  const letterSpacing = usePreferencesStore((state) => state.terminalLetterSpacing);
  const scrollback = usePreferencesStore((state) => state.terminalScrollback);
  const zoomLevel = usePreferencesStore((state) => state.zoomLevel);
  const webglEnabled = usePreferencesStore((state) => state.terminalWebglEnabled);
  const backgroundActive = usePreferencesStore(
    (state) => state.backgroundKind === "image" && !!state.backgroundImageId,
  );

  useEffect(() => { applyFontSize(Math.max(4, Math.round(fontSize))); }, [fontSize]);
  useEffect(() => { applyFontFamily(fontFamily); }, [fontFamily]);
  useEffect(() => { applyLetterSpacing(letterSpacing); }, [letterSpacing]);
  useEffect(() => { applyScrollback(scrollback); }, [scrollback]);
  useEffect(() => { applyZoomLevel(zoomLevel); }, [zoomLevel]);
  useEffect(() => { applyWebglPreference(webglEnabled); }, [webglEnabled]);
  useEffect(() => { applyBackgroundActive(backgroundActive); }, [backgroundActive]);
}
