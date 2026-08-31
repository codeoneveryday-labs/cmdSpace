import { detectMonoFontFamily } from "@/lib/fonts";
import { buildTerminalTheme } from "@/styles/terminalTheme";
import type { Terminal } from "@xterm/xterm";
import {
  effectiveTerminalFontSize,
  TERMINAL_ZOOM_MIN,
} from "./terminalOptions";

const FIT_DEBOUNCE_MS = 8;
const PTY_RESIZE_DEBOUNCE_MS = 32;

export type RendererPreferenceSlot = {
  term: Terminal;
  host: HTMLDivElement;
  currentLeafId: number | null;
  fitTimer: ReturnType<typeof setTimeout> | null;
  ptyTimer: ReturnType<typeof setTimeout> | null;
  lastCols: number;
  lastRows: number;
};

export type RendererPreferenceRuntime<SlotType extends RendererPreferenceSlot = RendererPreferenceSlot> = {
  slots: Iterable<SlotType>;
  getZoomLevel: () => number;
  getTerminalFontSize: () => number;
  applyHostZoom: (slot: SlotType, zoomLevel: number) => void;
  fitSlot: (slot: SlotType) => void;
  resolveLeaf: (leafId: number) => {
    resizePty(cols: number, rows: number): void;
  } | null;
};

export function createRendererPreferenceController<
  SlotType extends RendererPreferenceSlot,
>(
  runtime: RendererPreferenceRuntime<SlotType>,
) {
  const scheduleFitAndPtyResize = (slot: SlotType) => {
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
      runtime.fitSlot(slot);
      if (slot.ptyTimer) clearTimeout(slot.ptyTimer);
      slot.ptyTimer = setTimeout(() => {
        slot.ptyTimer = null;
        if (slot.currentLeafId !== leafId) return;
        if (slot.term.cols === beforeCols && slot.term.rows === beforeRows) return;
        slot.lastCols = slot.term.cols;
        slot.lastRows = slot.term.rows;
        runtime.resolveLeaf(leafId)?.resizePty(slot.term.cols, slot.term.rows);
      }, PTY_RESIZE_DEBOUNCE_MS);
    }, FIT_DEBOUNCE_MS);
  };

  return {
    applyFontSize(size: number) {
      const zoomLevel = runtime.getZoomLevel();
      for (const slot of runtime.slots) {
        const next = effectiveTerminalFontSize(size, zoomLevel);
        if (slot.term.options.fontSize === next) continue;
        slot.term.options.fontSize = next;
        scheduleFitAndPtyResize(slot);
      }
    },

    applyZoomLevel(zoomLevel: number) {
      const nextZoomLevel = Math.max(TERMINAL_ZOOM_MIN, zoomLevel || 1);
      const fontSize = runtime.getTerminalFontSize();
      for (const slot of runtime.slots) {
        runtime.applyHostZoom(slot, nextZoomLevel);
        const nextFontSize = effectiveTerminalFontSize(fontSize, nextZoomLevel);
        if (slot.term.options.fontSize !== nextFontSize) {
          slot.term.options.fontSize = nextFontSize;
        }
        // Debounce rapid key-repeat so all slots fit only once zoom settles.
        scheduleFitAndPtyResize(slot);
      }
    },

    applyLetterSpacing(spacing: number) {
      for (const slot of runtime.slots) {
        if (slot.term.options.letterSpacing === spacing) continue;
        slot.term.options.letterSpacing = spacing;
        runtime.fitSlot(slot);
      }
    },

    applyFontFamily(family: string) {
      const resolved = family || detectMonoFontFamily();
      for (const slot of runtime.slots) {
        if (slot.term.options.fontFamily === resolved) continue;
        slot.term.options.fontFamily = resolved;
        runtime.fitSlot(slot);
        if (slot.currentLeafId !== null) {
          slot.lastCols = slot.term.cols;
          slot.lastRows = slot.term.rows;
          runtime.resolveLeaf(slot.currentLeafId)?.resizePty(
            slot.term.cols,
            slot.term.rows,
          );
        }
      }
    },

    applyScrollback(value: number) {
      for (const slot of runtime.slots) {
        if (slot.term.options.scrollback === value) continue;
        slot.term.options.scrollback = value;
      }
    },

    applyTheme() {
      const theme = buildTerminalTheme();
      for (const slot of runtime.slots) {
        slot.term.options.theme = theme;
      }
    },
  };
}
