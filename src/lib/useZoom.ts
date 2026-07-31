import { useCallback, useEffect, useRef } from "react";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { setZoomLevel } from "@/modules/settings/store";
import {
  APP_ZOOM_CSS_VAR,
  APP_ZOOM_INVERSE_CSS_VAR,
  ZOOM_KEYBOARD_STEP,
  ZOOM_MAX,
  ZOOM_MIN,
} from "./zoomConstants";

function clampZoom(z: number): number {
  const rounded = Math.round(z * 100) / 100;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, rounded));
}

function applyToDom(z: number): void {
  document.documentElement.style.setProperty(APP_ZOOM_CSS_VAR, String(z));
  document.documentElement.style.setProperty(
    APP_ZOOM_INVERSE_CSS_VAR,
    String(1 / z),
  );
}

export function useZoom() {
  const zoomLevel = usePreferencesStore((s) => s.zoomLevel);
  const hydrated = usePreferencesStore((s) => s.hydrated);
  const lastAppliedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (lastAppliedRef.current === zoomLevel) return;
    lastAppliedRef.current = zoomLevel;
    applyToDom(zoomLevel);
  }, [hydrated, zoomLevel]);

  const zoomIn = useCallback(() => {
    const current = usePreferencesStore.getState().zoomLevel;
    const next = clampZoom(current + ZOOM_KEYBOARD_STEP);
    if (next !== current) void setZoomLevel(next);
  }, []);

  const zoomOut = useCallback(() => {
    const current = usePreferencesStore.getState().zoomLevel;
    const next = clampZoom(current - ZOOM_KEYBOARD_STEP);
    if (next !== current) void setZoomLevel(next);
  }, []);

  const zoomReset = useCallback(() => {
    if (usePreferencesStore.getState().zoomLevel !== 1.0) {
      void setZoomLevel(1.0);
    }
  }, []);

  return { zoomIn, zoomOut, zoomReset };
}
