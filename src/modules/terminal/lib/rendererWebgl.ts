import { usePreferencesStore } from "@/modules/settings/preferences";
import { WebglAddon } from "@xterm/addon-webgl";
import type { Slot } from "./rendererPool";

type WebglSlot = Pick<Slot, "term" | "webglAddon" | "webglCanvases" | "webglDisabledAfterContextLoss">;

export function attachWebgl(slot: WebglSlot): void {
  if (slot.webglAddon || !slot.term.element) return;
  if (slot.webglDisabledAfterContextLoss) return;
  if (!usePreferencesStore.getState().terminalWebglEnabled) return;
  const elem = slot.term.element;
  const before = new Set<HTMLCanvasElement>(
    elem.querySelectorAll<HTMLCanvasElement>("canvas"),
  );
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => {
      if (slot.webglAddon === webgl) {
        slot.webglDisabledAfterContextLoss = true;
        slot.webglAddon = null;
        slot.webglCanvases = [];
        console.warn(
          "[cmdspace-webgl] context lost; falling back to xterm's default renderer",
        );
        return;
      }
      try {
        webgl.dispose();
      } catch {}
    });
    slot.term.loadAddon(webgl);
    const after = elem.querySelectorAll<HTMLCanvasElement>("canvas");
    const added: HTMLCanvasElement[] = [];
    for (const c of after) if (!before.has(c)) added.push(c);
    slot.webglAddon = webgl;
    slot.webglCanvases = added;
  } catch (e) {
    console.warn("[cmdspace-webgl] unavailable:", e);
  }
}

export function disposeSlotWebgl(slot: WebglSlot): void {
  if (!slot.webglAddon) return;
  const addon = slot.webglAddon;
  for (const canvas of slot.webglCanvases) releaseCanvasContext(canvas);
  slot.webglCanvases = [];
  try {
    addon.dispose();
  } catch (e) {
    console.warn("[cmdspace-webgl] dispose failed:", e);
  }
  try {
    const r = (
      addon as unknown as { _renderer?: Record<string, unknown> | null }
    )._renderer;
    if (r) {
      r._canvas = null;
      r._gl = null;
      r._charAtlas = null;
      r._atlas = null;
    }
    (
      addon as unknown as { _renderer?: unknown; _renderService?: unknown }
    )._renderer = null;
    (
      addon as unknown as { _renderer?: unknown; _renderService?: unknown }
    )._renderService = null;
  } catch {}
  slot.webglAddon = null;
}

function releaseCanvasContext(canvas: HTMLCanvasElement): void {
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
  } catch {}
  if (!gl) {
    try {
      gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    } catch {}
  }
  if (gl) {
    try {
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext && !gl.isContextLost()) ext.loseContext();
    } catch {}
  }
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch {}
}

export function applyWebglPreference(slots: Iterable<WebglSlot>, enabled: boolean): void {
  for (const slot of slots) {
    if (!enabled) slot.webglDisabledAfterContextLoss = false;
    if (enabled && !slot.webglAddon) attachWebgl(slot);
    else if (!enabled && slot.webglAddon) disposeSlotWebgl(slot);
  }
}
