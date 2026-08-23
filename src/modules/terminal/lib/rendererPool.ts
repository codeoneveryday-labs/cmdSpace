import { detectMonoFontFamily } from "@/lib/fonts";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { buildTerminalTheme } from "@/styles/terminalTheme";
import { openUrl } from "@tauri-apps/plugin-opener";
import { traceTerminalInput } from "./terminal-native";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { SerializeAddon } from "@xterm/addon-serialize";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import {
  terminalLineBoundarySequence,
  terminalWordNavigationSequence,
} from "./keymap";
import {
  createMacCompositionCommitFilter,
  IS_MAC_TEXT_INPUT_PLATFORM,
  normalizeMacTerminalInput,
} from "./macImeBridge";
import {
  currentTerminalZoomLevel,
  effectiveTerminalFontSize,
  sharedTerminalOptions,
  TERMINAL_ZOOM_MIN,
} from "./terminalOptions";

export const POOL_MAX_SIZE = 12;
const FIT_DEBOUNCE_MS = 8;
const PTY_RESIZE_DEBOUNCE_MS = 32;
const AUTO_COPY_SELECTION_DEBOUNCE_MS = 120;
const AUTO_COPY_BADGE_MS = 1_200;
const SNAPSHOT_SCROLLBACK_CAP = 5_000;
const MCR_BG_ACTIVE = 4.5;
const MCR_BG_INACTIVE = 1;
const OSC_COLOR_REPORT = /^(?:\x1b](?:10|11);rgb:[0-9a-f]{4}\/[0-9a-f]{4}\/[0-9a-f]{4}\x1b\\)+$/i;

export type SlotAdapter = {
  resolveLeaf(leafId: number): LeafBridge | null;
  evictLeaf(leafId: number): void;
  isLeafFocused(leafId: number): boolean;
};

export type LeafBridge = {
  writeToPty(data: string): void;
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
let terminalResizePaused = false;
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
  const compositionCommitFilter = createMacCompositionCommitFilter();
  if (IS_MAC_TEXT_INPUT_PLATFORM) {
    slot.term.textarea?.addEventListener(
      "compositionend",
      compositionCommitFilter.beginCompositionFinalization,
    );
    host.ownerDocument.defaultView?.addEventListener(
      "blur",
      compositionCommitFilter.handleWindowBlur,
    );
    host.ownerDocument.defaultView?.addEventListener(
      "focus",
      compositionCommitFilter.handleWindowFocus,
    );
  }
  attachCopyOnSelection(slot);
  term.attachCustomKeyEventHandler((event) => {
    // If the user is currently composing an IME character (e.g. Vietnamese Telex),
    // let xterm's internal textarea handle it without custom key intercepts.
    if (event.isComposing || event.keyCode === 229 || event.key === "Process") {
      if (event.type === "keydown" && event.metaKey) {
        compositionCommitFilter.beginKeydownFinalization();
      }
      return true;
    }

    const lineBoundary = terminalLineBoundarySequence(event);
    if (lineBoundary) {
      const leafId = slot.currentLeafId;
      if (leafId === null) return false;
      const bridge = adapter?.resolveLeaf(leafId);
      if (!bridge) return true;
      event.preventDefault();
      if (event.type === "keydown") bridge.writeToPty(lineBoundary);
      return false;
    }

    // Keep Command + Arrows without Shift available for global pane navigation.
    if (event.metaKey && event.key.startsWith("Arrow")) {
      return false;
    }

    const leafId = slot.currentLeafId;
    if (leafId === null) return false;
    const bridge = adapter?.resolveLeaf(leafId);
    if (!bridge) return true;
    const wordNavigation = terminalWordNavigationSequence(event);
    if (wordNavigation) {
      event.preventDefault();
      if (event.type === "keydown") bridge.writeToPty(wordNavigation);
      return false;
    }
    if (isClearTerminalInput(event)) {
      event.preventDefault();
      if (event.type === "keydown") bridge.writeToPty("\x15\x0b");
      return false;
    }
    if (isCtrlBackspace(event)) {
      event.preventDefault();
      if (event.type === "keydown") bridge.writeToPty("\x17");
      return false;
    }
    if (isDeleteToEndOfLine(event)) {
      event.preventDefault();
      if (event.type === "keydown") bridge.writeToPty("\x0b");
      return false;
    }
    if (isShiftEnter(event)) {
      event.preventDefault();
      if (event.type === "keydown") bridge.writeToPty("\x1b\r");
      return false;
    }
    if (isTerminalCopy(event)) {
      if (event.type === "keydown" && slot.term.hasSelection()) {
        const sel = slot.term.getSelection();
        if (sel) writeSelectionToClipboard(slot, sel);
      }
      event.preventDefault();
      return false;
    }
    return true;
  });

  term.onData((data) => {
    const leafId = slot.currentLeafId;
    if (leafId === null) return;

    // xterm emits OSC 10/11 color reports on its input channel. They are
    // terminal metadata, not user input; forwarding them can corrupt zsh's
    // history recall when a report arrives alongside an arrow key sequence.
    if (OSC_COLOR_REPORT.test(data)) return;

    const bridge = adapter?.resolveLeaf(leafId);
    if (!bridge) return;
    // WebKit on macOS can surface space characters in clipboard content as
    // invisible C1 control chars (U+0080–U+009F), causing pasted words to
    // fuse into a single token at the shell. xterm's native paste listener
    // feeds this path, so normalize before forwarding to the PTY.
    const normalized = IS_MAC_TEXT_INPUT_PLATFORM
      ? normalizeMacTerminalInput(data)
      : data;
    if (!compositionCommitFilter.shouldForward(normalized)) return;
    void traceTerminalInput("xterm-ondata", normalized);
    if (normalized.includes("\r") || normalized.includes("\n")) {
      bridge.observeInputLine?.(currentInputLine(slot.term));
    }
    bridge.writeToPty(normalized);
  });

  slots.push(slot);
  return slot;
}

function currentInputLine(term: Terminal): string {
  const buffer = term.buffer.active;
  return (
    buffer
      .getLine(buffer.baseY + buffer.cursorY)
      ?.translateToString(true) ?? ""
  );
}

function attachCopyOnSelection(slot: Slot): void {
  slot.term.onSelectionChange(() => {
    if (slot.autoCopyTimer) clearTimeout(slot.autoCopyTimer);
    slot.autoCopyTimer = setTimeout(() => {
      slot.autoCopyTimer = null;
      if (!usePreferencesStore.getState().terminalCopyOnSelection) return;

      const selection = slot.term.getSelection();
      if (!selection) {
        slot.lastAutoCopiedSelection = "";
        return;
      }
      if (selection === slot.lastAutoCopiedSelection) return;

      slot.lastAutoCopiedSelection = selection;
      writeSelectionToClipboard(slot, selection, true);
    }, AUTO_COPY_SELECTION_DEBOUNCE_MS);
  });
}

function writeSelectionToClipboard(
  slot: Slot,
  selection: string,
  clearSelectionAfterCopy = false,
): void {
  void navigator.clipboard
    .writeText(selection)
    .then(() => {
      showAutoCopyBadge(slot);
      if (clearSelectionAfterCopy) slot.term.clearSelection();
    })
    .catch(() => {});
}

function showAutoCopyBadge(slot: Slot): void {
  let badge = slot.copyBadge;
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "cmdspace-terminal-copy-badge";
    badge.setAttribute("role", "status");
    badge.setAttribute("aria-live", "polite");
    slot.host.appendChild(badge);
    slot.copyBadge = badge;
  }

  badge.textContent = "Copied";
  badge.classList.add("is-visible");
  if (slot.copyBadgeTimer) clearTimeout(slot.copyBadgeTimer);
  slot.copyBadgeTimer = setTimeout(() => {
    badge.classList.remove("is-visible");
    slot.copyBadgeTimer = null;
  }, AUTO_COPY_BADGE_MS);
}


type PickResult = { slot: Slot; previousLeafId: number | null };

function isAltScreen(s: Slot): boolean {
  try {
    return s.term.buffer.active.type === "alternate";
  } catch {
    return false;
  }
}

function pickSlotFor(leafId: number): PickResult {
  const free = slots.find((s) => s.currentLeafId === null);
  if (free) return { slot: free, previousLeafId: null };
  if (slots.length < POOL_MAX_SIZE)
    return { slot: createSlot(), previousLeafId: null };

  let best: Slot | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const s of slots) {
    if (s.currentLeafId === leafId) return { slot: s, previousLeafId: null };
    const focused =
      s.currentLeafId !== null &&
      (adapter?.isLeafFocused(s.currentLeafId) ?? false);
    const score =
      (isAltScreen(s) ? 100 : 0) + (focused ? 10 : 0) + s.lastUsedAt / 1e12;
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  const chosen = best!;
  return { slot: chosen, previousLeafId: chosen.currentLeafId };
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
    rewireSlot(existing, params);
    return existing;
  }

  const pick = pickSlotFor(params.leafId);
  if (pick.previousLeafId !== null) {
    adapter?.evictLeaf(pick.previousLeafId);
  }
  if (
    pick.slot.currentLeafId !== null &&
    pick.slot.currentLeafId !== params.leafId
  ) {
    detachSlotFromLeaf(pick.slot);
  }
  bindSlot(pick.slot, params);
  return pick.slot;
}

function bindSlot(slot: Slot, p: AcquireParams): void {
  slot.currentLeafId = p.leafId;
  slot.lastUsedAt = performance.now();

  cancelPendingUnhide(slot);
  slot.host.style.visibility = "hidden";

  if (slot.host.parentNode !== p.container) {
    p.container.appendChild(slot.host);
  }

  slot.term.options.disableStdin = p.shellExited;
  slot.term.clear();
  slot.term.reset();

  if (
    p.cols > 0 &&
    p.rows > 0 &&
    (slot.term.cols !== p.cols || slot.term.rows !== p.rows)
  ) {
    slot.term.resize(p.cols, p.rows);
  }

  if (p.snapshot) {
    try {
      slot.term.write(p.snapshot);
    } catch (e) {
      console.warn("[cmdspace] snapshot replay failed:", e);
    }
  }
  if (p.altScreen) {
    // Discard the dormant ring. TUI output is incremental cursor-positioned
    // updates that can't be replayed coherently on top of a stale snapshot
    // — see the SIGWINCH kick below, which makes the TUI redraw from scratch.
    p.drainRing(() => {});
  } else {
    p.drainRing((bytes) => slot.term.write(bytes));
  }
  try {
    slot.term.write("\x1b[?25h");
  } catch {}

  for (const d of slot.oscDisposers) {
    try {
      d();
    } catch {}
  }
  slot.oscDisposers = p.registerOsc(slot.term);

  setupResizeObserver(slot, p);
  fitSlot(slot);
  schedulePostLayoutFit(slot);
  slot.lastCols = slot.term.cols;
  slot.lastRows = slot.term.rows;
  slot.lastW = p.container.clientWidth;
  slot.lastH = p.container.clientHeight;
  // The native terminal is the authority for an attached PTY's dimensions.
  // Reassert them on every bind so a remote client cannot leave the backend
  // using a narrower mobile width after the pane returns to the desktop.
  adapter?.resolveLeaf(p.leafId)?.resizePty(slot.lastCols, slot.lastRows);

  if (p.searchQuery) {
    try {
      slot.searchAddon.findNext(p.searchQuery);
    } catch {}
  }

  applyCursorBlinkOnSlot(slot, adapter?.isLeafFocused(p.leafId) ?? false);

  if (p.altScreen && !p.shellExited) {
    adapter?.resolveLeaf(p.leafId)?.kickPty(slot.term.cols, slot.term.rows);
  }

  scheduleUnhide(slot);

  p.onSearchReady(slot.searchAddon);
}

function scheduleUnhide(slot: Slot): void {
  slot.unhideRaf = requestAnimationFrame(() => {
    slot.unhideRaf = requestAnimationFrame(() => {
      slot.unhideRaf = null;
      slot.host.style.visibility = "";
      const leafId = slot.currentLeafId;
      if (leafId !== null && adapter?.isLeafFocused(leafId)) {
        slot.term.focus();
      }
    });
  });
}

function cancelPendingUnhide(slot: Slot): void {
  if (slot.unhideRaf !== null) {
    cancelAnimationFrame(slot.unhideRaf);
    slot.unhideRaf = null;
  }
}

function rewireSlot(slot: Slot, p: AcquireParams): void {
  slot.lastUsedAt = performance.now();
  applyCursorStyle(slot);
  if (slot.host.parentNode !== p.container) {
    p.container.appendChild(slot.host);
  }
  setupResizeObserver(slot, p);
  fitSlot(slot);
  schedulePostLayoutFit(slot);
  slot.lastW = p.container.clientWidth;
  slot.lastH = p.container.clientHeight;
  adapter?.resolveLeaf(p.leafId)?.resizePty(slot.term.cols, slot.term.rows);
  slot.lastCols = slot.term.cols;
  slot.lastRows = slot.term.rows;
  p.onSearchReady(slot.searchAddon);
}

function fitSlot(slot: Slot): void {
  const container = slot.host.parentElement;
  if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) {
    return;
  }
  const dims = slot.fitAddon.proposeDimensions();
  if (dims) {
    const cols = Math.max(10, Math.floor(dims.cols));
    const rows = Math.max(3, Math.floor(dims.rows));
    if (slot.term.cols !== cols || slot.term.rows !== rows) {
      slot.term.resize(cols, rows);
    }
  }
}

function clearSlotResizeTimers(slot: Slot): void {
  if (slot.fitTimer) clearTimeout(slot.fitTimer);
  if (slot.ptyTimer) clearTimeout(slot.ptyTimer);
  slot.fitTimer = null;
  slot.ptyTimer = null;
}

function clearSlotAutoCopyTimer(slot: Slot): void {
  if (slot.autoCopyTimer) clearTimeout(slot.autoCopyTimer);
  if (slot.copyBadgeTimer) clearTimeout(slot.copyBadgeTimer);
  slot.autoCopyTimer = null;
  slot.copyBadgeTimer = null;
  slot.copyBadge?.classList.remove("is-visible");
}

function fitSlotFromCurrentHost(slot: Slot): void {
  const leafId = slot.currentLeafId;
  if (leafId === null) return;
  const container = slot.host.parentElement as HTMLElement | null;
  if (!container || container === recyclerEl) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w <= 0 || h <= 0) return;
  slot.lastW = w;
  slot.lastH = h;
  fitSlot(slot);
  refreshSlot(slot);
  if (slot.term.cols === slot.lastCols && slot.term.rows === slot.lastRows)
    return;
  slot.lastCols = slot.term.cols;
  slot.lastRows = slot.term.rows;
  adapter?.resolveLeaf(leafId)?.resizePty(slot.lastCols, slot.lastRows);
}

function schedulePostLayoutFit(slot: Slot): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (slot.currentLeafId !== null) fitSlotFromCurrentHost(slot);
    });
  });
}

function refreshSlot(slot: Slot): void {
  try {
    slot.term.refresh(0, Math.max(0, slot.term.rows - 1));
  } catch {
    // A slot can be disposed between ResizeObserver and the repaint frame.
  }
}

export function setTerminalResizePaused(paused: boolean): void {
  if (terminalResizePaused === paused) return;
  terminalResizePaused = paused;

  if (paused) {
    for (const slot of slots) clearSlotResizeTimers(slot);
    return;
  }

  const targets = new Set(slots.filter((slot) => slot.currentLeafId !== null));
  for (const slot of pendingResizeSlots) targets.add(slot);
  pendingResizeSlots.clear();

  for (const slot of targets) {
    clearSlotResizeTimers(slot);
    fitSlotFromCurrentHost(slot);
  }
}

function setupResizeObserver(slot: Slot, p: AcquireParams): void {
  slot.observer?.disconnect();
  clearSlotResizeTimers(slot);

  const container = p.container;
  const flushPty = () => {
    slot.ptyTimer = null;
    if (slot.currentLeafId !== p.leafId) return;
    if (slot.term.cols === slot.lastCols && slot.term.rows === slot.lastRows)
      return;
    slot.lastCols = slot.term.cols;
    slot.lastRows = slot.term.rows;
    adapter?.resolveLeaf(p.leafId)?.resizePty(slot.lastCols, slot.lastRows);
  };

  slot.observer = new ResizeObserver(() => {
    if (terminalResizePaused) {
      pendingResizeSlots.add(slot);
      return;
    }
    if (slot.fitTimer) clearTimeout(slot.fitTimer);
    slot.fitTimer = setTimeout(() => {
      slot.fitTimer = null;
      if (slot.currentLeafId !== p.leafId) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === slot.lastW && h === slot.lastH) return;
      slot.lastW = w;
      slot.lastH = h;
      fitSlot(slot);
      if (slot.ptyTimer) clearTimeout(slot.ptyTimer);
      slot.ptyTimer = setTimeout(flushPty, PTY_RESIZE_DEBOUNCE_MS);
    }, FIT_DEBOUNCE_MS);
  });
  slot.observer.observe(container);
}

export type SerializeOutput = {
  snapshot: string | null;
  cols: number;
  rows: number;
  altScreen: boolean;
};

export function releaseSlot(leafId: number): SerializeOutput | null {
  const slot = slots.find((s) => s.currentLeafId === leafId);
  if (!slot) return null;
  const out = serializeSlot(slot);
  detachSlotFromLeaf(slot);
  return out;
}

function serializeSlot(slot: Slot): SerializeOutput {
  let snapshot: string | null = null;
  try {
    const cap = Math.min(
      SNAPSHOT_SCROLLBACK_CAP,
      usePreferencesStore.getState().terminalScrollback,
    );
    snapshot = slot.serializeAddon.serialize({ scrollback: cap });
  } catch (e) {
    console.warn("[cmdspace] serialize failed:", e);
  }
  return {
    snapshot,
    cols: slot.term.cols,
    rows: slot.term.rows,
    altScreen: isAltScreen(slot),
  };
}

function detachSlotFromLeaf(slot: Slot): void {
  for (const d of slot.oscDisposers) {
    try {
      d();
    } catch {}
  }
  slot.oscDisposers = [];

  slot.observer?.disconnect();
  slot.observer = null;
  clearSlotResizeTimers(slot);
  clearSlotAutoCopyTimer(slot);
  pendingResizeSlots.delete(slot);

  cancelPendingUnhide(slot);
  slot.host.style.visibility = "";

  if (slot.host.parentNode !== getRecycler()) {
    getRecycler().appendChild(slot.host);
  }

  slot.currentLeafId = null;
  slot.lastUsedAt = performance.now();
}

function attachWebgl(slot: Slot): void {
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

function disposeSlotWebgl(slot: Slot): void {
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

export function applyWebglPreference(enabled: boolean): void {
  for (const slot of slots) {
    if (!enabled) slot.webglDisabledAfterContextLoss = false;
    if (enabled && !slot.webglAddon) attachWebgl(slot);
    else if (!enabled && slot.webglAddon) disposeSlotWebgl(slot);
  }
}

export function applyFontSize(size: number): void {
  const zoomLevel = currentTerminalZoomLevel();
  for (const slot of slots) {
    const next = effectiveTerminalFontSize(size, zoomLevel);
    if (slot.term.options.fontSize === next) continue;
    slot.term.options.fontSize = next;
    scheduleFitAndPtyResize(slot);
  }
}

export function applyZoomLevel(zoomLevel: number): void {
  const nextZoomLevel = Math.max(TERMINAL_ZOOM_MIN, zoomLevel || 1);
  const fontSize = usePreferencesStore.getState().terminalFontSize;
  for (const slot of slots) {
    applyHostZoom(slot, nextZoomLevel);
    const nextFontSize = effectiveTerminalFontSize(fontSize, nextZoomLevel);
    if (slot.term.options.fontSize !== nextFontSize) {
      slot.term.options.fontSize = nextFontSize;
    }
    // Defer fit + PTY resize: Cmd+=/- key-repeat fires this on every step,
    // and re-fitting every slot synchronously per step stutters the app.
    // Debounce so the work only runs once the zoom settles.
    scheduleFitAndPtyResize(slot);
  }
}

/** Debounced fit + PTY resize, coalescing rapid preference changes (zoom,
 *  font size, letter spacing) into one layout pass per slot. */
function scheduleFitAndPtyResize(slot: Slot): void {
  if (slot.fitTimer) clearTimeout(slot.fitTimer);
  slot.fitTimer = setTimeout(() => {
    slot.fitTimer = null;
    const leafId = slot.currentLeafId;
    if (leafId === null) return;
    const container = slot.host.parentElement;
    if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) {
      return;
    }
    const beforeCols = slot.term.cols;
    const beforeRows = slot.term.rows;
    fitSlot(slot);
    if (slot.ptyTimer) clearTimeout(slot.ptyTimer);
    slot.ptyTimer = setTimeout(() => {
      slot.ptyTimer = null;
      if (slot.currentLeafId !== leafId) return;
      if (slot.term.cols === beforeCols && slot.term.rows === beforeRows) return;
      slot.lastCols = slot.term.cols;
      slot.lastRows = slot.term.rows;
      adapter?.resolveLeaf(leafId)?.resizePty(slot.term.cols, slot.term.rows);
    }, PTY_RESIZE_DEBOUNCE_MS);
  }, FIT_DEBOUNCE_MS);
}

export function applyLetterSpacing(spacing: number): void {
  for (const slot of slots) {
    if (slot.term.options.letterSpacing === spacing) continue;
    slot.term.options.letterSpacing = spacing;
    fitSlot(slot);
  }
}

export function applyFontFamily(family: string): void {
  const resolved = family || detectMonoFontFamily();
  for (const slot of slots) {
    if (slot.term.options.fontFamily === resolved) continue;
    slot.term.options.fontFamily = resolved;
    fitSlot(slot);
    if (slot.currentLeafId !== null) {
      slot.lastCols = slot.term.cols;
      slot.lastRows = slot.term.rows;
      const bridge = adapter?.resolveLeaf(slot.currentLeafId);
      bridge?.resizePty(slot.term.cols, slot.term.rows);
    }
  }
}

export function applyScrollback(value: number): void {
  for (const slot of slots) {
    if (slot.term.options.scrollback === value) continue;
    slot.term.options.scrollback = value;
  }
}

export function applyTheme(): void {
  const theme = buildTerminalTheme();
  for (const slot of slots) {
    slot.term.options.theme = theme;
  }
}

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

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

function isTerminalCopy(e: KeyboardEvent): boolean {
  return (
    !IS_MAC &&
    e.ctrlKey &&
    e.shiftKey &&
    !e.altKey &&
    !e.metaKey &&
    (e.code === "KeyC" || e.key === "c" || e.key === "C")
  );
}

/** Cmd+Shift+Delete clears both sides of the terminal cursor. Ctrl+U removes
 * the prefix and Ctrl+K removes the suffix, so the whole draft is cleared. */
function isClearTerminalInput(event: KeyboardEvent): boolean {
  return (
    IS_MAC &&
    event.metaKey &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    (event.key === "Backspace" ||
      event.code === "Backspace" ||
      event.key === "Delete" ||
      event.code === "Delete")
  );
}

function isCtrlBackspace(e: KeyboardEvent): boolean {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMac = /Mac|iPhone|iPad/.test(ua);
  const mod = isMac ? e.metaKey : e.ctrlKey;
  return mod && (e.key === "Backspace" || e.code === "Backspace");
}

/** Cmd+Delete (macOS) / Ctrl+Delete (elsewhere): delete from the cursor to
 *  the end of the line, like Ctrl+K in readline/vim. Sends `\x0b`. */
function isDeleteToEndOfLine(e: KeyboardEvent): boolean {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMac = /Mac|iPhone|iPad/.test(ua);
  const mod = isMac ? e.metaKey : e.ctrlKey;
  return mod && (e.key === "Delete" || e.code === "Delete");
}

function isShiftEnter(e: KeyboardEvent): boolean {
  return (
    e.key === "Enter" && e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey
  );
}
