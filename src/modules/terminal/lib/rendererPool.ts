import { usePreferencesStore } from "@/modules/settings/preferences";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { SerializeAddon } from "@xterm/addon-serialize";
import { WebLinksAddon } from "@xterm/addon-web-links";
import type { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import {
  DARK_TERMINAL_THEME,
  buildTerminalTheme,
} from "@/styles/terminalTheme";
import {
  currentTerminalZoomLevel,
  sharedTerminalOptions,
} from "./terminalOptions";
import { selectRendererSlot } from "./rendererSlotModel";
import {
  applyWebglPreference as applyWebglPreferenceToSlots,
  attachWebgl,
} from "./rendererWebgl";
import { createRendererPreferenceController } from "./rendererPreferences";
import { configureRendererInput } from "./rendererInput";
import { createRendererResizeController } from "./rendererResize";
import { createRendererSlotLifecycle } from "./rendererSlotLifecycle";
import {
  serializeRendererSlot,
  type RendererSerializeOutput,
} from "./rendererSerialization";

export const POOL_MAX_SIZE = 12;
const SNAPSHOT_SCROLLBACK_CAP = 5_000;
const MCR_BG_ACTIVE = 4.5;
const MCR_BG_INACTIVE = 1;

export type SlotAdapter = {
  resolveLeaf(leafId: number): LeafBridge | null;
  evictLeaf(leafId: number): void;
  isLeafFocused(leafId: number): boolean;
};

export type LeafBridge = {
  writeToPty(data: string): void;
  isHerdr?(): boolean;
  isDarkAgent?(): boolean;
  observeInputLine?(line: string): void;
  resizePty(cols: number, rows: number): void;
  // Force a SIGWINCH on the underlying PTY at the given dims. Implemented
  // as a +1 row / restore bump because the Linux kernel suppresses winsize
  // ioctls that don't actually change the size. Used to make alt-screen
  // TUIs repaint from scratch after they were dormant.
  kickPty(cols: number, rows: number): void;
};

export type Slot = {
  readonly id: number;
  readonly term: Terminal;
  readonly fitAddon: FitAddon;
  readonly searchAddon: SearchAddon;
  readonly serializeAddon: SerializeAddon;
  readonly host: HTMLDivElement;
  webglAddon: WebglAddon | null;
  webglCanvases: HTMLCanvasElement[];
  webglDisabledAfterContextLoss: boolean;
  currentLeafId: number | null;
  oscDisposers: (() => void)[];
  observer: ResizeObserver | null;
  fitTimer: ReturnType<typeof setTimeout> | null;
  ptyTimer: ReturnType<typeof setTimeout> | null;
  autoCopyTimer: ReturnType<typeof setTimeout> | null;
  copyBadgeTimer: ReturnType<typeof setTimeout> | null;
  copyBadge: HTMLDivElement | null;
  lastAutoCopiedSelection: string;
  unhideRaf: number | null;
  lastCols: number;
  lastRows: number;
  lastW: number;
  lastH: number;
  lastUsedAt: number;
};

const slots: Slot[] = [];
let recyclerEl: HTMLDivElement | null = null;
let adapter: SlotAdapter | null = null;
const pendingResizeSlots = new Set<Slot>();

export function configureRendererPool(a: SlotAdapter): void {
  adapter = a;
}

export function forEachSlot(fn: (slot: Slot) => void): void {
  for (const s of slots) fn(s);
}

export function poolSize(): number {
  return slots.length;
}

function getRecycler(): HTMLDivElement {
  if (recyclerEl && recyclerEl.isConnected) return recyclerEl;
  const el = document.createElement("div");
  el.setAttribute("data-cmdspace-recycler", "");
  el.style.cssText =
    "position:fixed;left:-99999px;top:-99999px;width:1024px;height:768px;overflow:hidden;pointer-events:none;contain:strict;";
  document.body.appendChild(el);
  recyclerEl = el;
  return el;
}

const rendererResize = createRendererResizeController({
  slots,
  pendingResizeSlots,
  getRecycler,
  getAdapter: () => adapter,
});

function applyHostZoom(
  slot: Pick<Slot, "host">,
  zoomLevel = currentTerminalZoomLevel(),
): void {
  slot.host.classList.add("cmdspace-terminal-zoom-surface");
  slot.host.style.width = `${zoomLevel * 100}%`;
  slot.host.style.height = `${zoomLevel * 100}%`;
  slot.host.style.transform = `scale(${1 / zoomLevel})`;
  slot.host.style.transformOrigin = "top left";
}

export function applyBackgroundActive(active: boolean): void {
  const value = active ? MCR_BG_ACTIVE : MCR_BG_INACTIVE;
  for (const slot of slots) {
    if (slot.term.options.minimumContrastRatio === value) continue;
    slot.term.options.minimumContrastRatio = value;
  }
}

function createSlot(): Slot {
  const term = new Terminal(sharedTerminalOptions());
  const fitAddon = new FitAddon();
  const searchAddon = new SearchAddon();
  const serializeAddon = new SerializeAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(searchAddon);
  term.loadAddon(serializeAddon);
  term.loadAddon(
    new WebLinksAddon((_e, uri) => openUrl(uri).catch(console.error)),
  );

  const host = document.createElement("div");
  host.style.cssText = "position:relative;width:100%;height:100%;";
  host.setAttribute("data-cmdspace-slot", String(slots.length));
  host.classList.add("cmdspace-terminal-zoom-surface");
  applyHostZoom({ host });
  getRecycler().appendChild(host);
  term.open(host);

  const slot: Slot = {
    id: slots.length,
    term,
    fitAddon,
    searchAddon,
    serializeAddon,
    host,
    webglAddon: null,
    webglCanvases: [],
    webglDisabledAfterContextLoss: false,
    currentLeafId: null,
    oscDisposers: [],
    observer: null,
    fitTimer: null,
    ptyTimer: null,
    autoCopyTimer: null,
    copyBadgeTimer: null,
    copyBadge: null,
    lastAutoCopiedSelection: "",
    unhideRaf: null,
    lastCols: term.cols,
    lastRows: term.rows,
    lastW: 0,
    lastH: 0,
    lastUsedAt: 0,
  };

  // CLI TUIs can send DECSCUSR and replace the app cursor with an underline
  // or outline. Keep cmdSpace's cursor contract stable for every terminal.
  slot.term.parser.registerCsiHandler(
    { intermediates: " ", final: "q" },
    () => {
      applyCursorStyle(slot);
      slot.term.refresh(0, Math.max(0, slot.term.rows - 1));
      return true;
    },
  );

  attachWebgl(slot);
  configureRendererInput(slot, {
    resolveLeaf: (leafId) => adapter?.resolveLeaf(leafId) ?? null,
  });
  slots.push(slot);
  return slot;
}

type PickResult = { slot: Slot; previousLeafId: number | null };

function isAltScreen(s: Slot): boolean {
  try {
    return s.term.buffer.active.type === "alternate";
  } catch {
    return false;
  }
}

function pickSlotFor(): PickResult {
  const selection = selectRendererSlot(
    slots.map((slot) => ({
      currentLeafId: slot.currentLeafId,
      altScreen: isAltScreen(slot),
      focused:
        slot.currentLeafId !== null &&
        (adapter?.isLeafFocused(slot.currentLeafId) ?? false),
      lastUsedAt: slot.lastUsedAt,
    })),
    POOL_MAX_SIZE,
  );
  if (selection.type === "create") {
    return { slot: createSlot(), previousLeafId: null };
  }
  const slot = slots[selection.index];
  if (!slot) return { slot: createSlot(), previousLeafId: null };
  return {
    slot,
    previousLeafId: selection.type === "evict" ? selection.previousLeafId : null,
  };
}

export type AcquireParams = {
  leafId: number;
  container: HTMLDivElement;
  snapshot: string | null;
  // True if the slot was in alt-screen mode (TUI like vim, htop, dofek)
  // at the time it was released. When set, bindSlot skips ring replay
  // and kicks SIGWINCH so the TUI repaints from scratch.
  altScreen: boolean;
  drainRing: (write: (bytes: Uint8Array) => void) => void;
  shellExited: boolean;
  searchQuery: string | null;
  cols: number;
  rows: number;
  registerOsc: (term: Terminal) => (() => void)[];
  onSearchReady: (addon: SearchAddon) => void;
};

export function acquireSlot(params: AcquireParams): Slot {
  const existing = slots.find((s) => s.currentLeafId === params.leafId);
  if (existing) {
    rendererSlotLifecycle.rewireSlot(existing, params);
    return existing;
  }

  const pick = pickSlotFor();
  if (pick.previousLeafId !== null) {
    adapter?.evictLeaf(pick.previousLeafId);
  }
  if (
    pick.slot.currentLeafId !== null &&
    pick.slot.currentLeafId !== params.leafId
  ) {
    rendererSlotLifecycle.detachSlotFromLeaf(pick.slot);
  }
  rendererSlotLifecycle.bindSlot(pick.slot, params);
  return pick.slot;
}

function clearSlotAutoCopyTimer(slot: Slot): void {
  if (slot.autoCopyTimer) clearTimeout(slot.autoCopyTimer);
  if (slot.copyBadgeTimer) clearTimeout(slot.copyBadgeTimer);
  slot.autoCopyTimer = null;
  slot.copyBadgeTimer = null;
  slot.copyBadge?.classList.remove("is-visible");
}

const rendererSlotLifecycle = createRendererSlotLifecycle({
  resize: rendererResize,
  getAdapter: () => adapter,
  getRecycler,
  clearSlotAutoCopyTimer,
  applyCursorStyle,
  applyCursorBlink: applyCursorBlinkOnSlot,
});

export type SerializeOutput = RendererSerializeOutput;

export function releaseSlot(leafId: number): SerializeOutput | null {
  const slot = slots.find((s) => s.currentLeafId === leafId);
  if (!slot) return null;
  const out = serializeSlot(slot);
  rendererSlotLifecycle.detachSlotFromLeaf(slot);
  return out;
}

function serializeSlot(slot: Slot): SerializeOutput {
  const cap = Math.min(
    SNAPSHOT_SCROLLBACK_CAP,
    usePreferencesStore.getState().terminalScrollback,
  );
  return serializeRendererSlot(slot, cap, isAltScreen(slot));
}

export const setTerminalResizePaused = rendererResize.setTerminalResizePaused;

export function applyWebglPreference(enabled: boolean): void {
  applyWebglPreferenceToSlots(slots, enabled);
}

const rendererPreferences = createRendererPreferenceController({
  slots,
  getZoomLevel: currentTerminalZoomLevel,
  getTerminalFontSize: () => usePreferencesStore.getState().terminalFontSize,
  applyHostZoom,
  fitSlot: rendererResize.fitSlot,
  resolveLeaf: (leafId) => adapter?.resolveLeaf(leafId) ?? null,
});

export const applyFontSize = rendererPreferences.applyFontSize;
export const applyZoomLevel = rendererPreferences.applyZoomLevel;
export const applyLetterSpacing = rendererPreferences.applyLetterSpacing;
export const applyFontFamily = rendererPreferences.applyFontFamily;
export const applyScrollback = rendererPreferences.applyScrollback;
export const applyTheme = rendererPreferences.applyTheme;


export function focusSlot(leafId: number): void {
  const slot = slots.find((s) => s.currentLeafId === leafId);
  slot?.term.focus();
}

export function setSlotFocused(leafId: number, focused: boolean): void {
  const slot = slots.find((s) => s.currentLeafId === leafId);
  if (!slot) return;
  applyCursorStyle(slot);
  applyCursorBlinkOnSlot(slot, focused);
}

function applyCursorStyle(slot: Slot): void {
  if (slot.term.options.cursorStyle !== "bar") {
    slot.term.options.cursorStyle = "bar";
  }
  if (slot.term.options.cursorInactiveStyle !== "bar") {
    slot.term.options.cursorInactiveStyle = "bar";
  }
}

function applyCursorBlinkOnSlot(slot: Slot, focused: boolean): void {
  const desired = focused;
  if (slot.term.options.cursorBlink === desired) return;
  slot.term.options.cursorBlink = desired;
}

export function getSlotForLeaf(leafId: number): Slot | null {
  return slots.find((s) => s.currentLeafId === leafId) ?? null;
}

export function syncSlotThemeForLeaf(leafId: number): void {
  const slot = slots.find((s) => s.currentLeafId === leafId);
  if (!slot) return;
  const bridge = adapter?.resolveLeaf(leafId);
  if (bridge?.isDarkAgent?.() || bridge?.isHerdr?.()) {
    slot.term.options.theme = DARK_TERMINAL_THEME;
    slot.host.style.backgroundColor = "#09090b";
  } else {
    slot.term.options.theme = buildTerminalTheme();
    slot.host.style.backgroundColor = "";
  }
}

