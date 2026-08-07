import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const rendererPoolPath = path.join(here, "rendererPool.ts");
const macImeBridgePath = path.join(here, "macImeBridge.ts");
const terminalOptionsPath = path.join(here, "terminalOptions.ts");
const settingsStorePath = path.join(here, "../../settings/store.ts");
const globalsCssPath = path.join(here, "../../../styles/globals.css");
const canvasTerminalNodePath = path.join(
  here,
  "../../architecture/CanvasTerminalNode.tsx",
);

describe("rendererPool WebGL stability", () => {
  it("keeps the renderer pool inside the pane cap", () => {
    const source = readFileSync(rendererPoolPath, "utf8");

    expect(source).toContain("POOL_MAX_SIZE = 12");
  });

  it("uses a vertical cursor in both focused and inactive panes", () => {
    const source = readFileSync(rendererPoolPath, "utf8");
    const optionsSource = readFileSync(terminalOptionsPath, "utf8");

    expect(source).toContain("sharedTerminalOptions");
    expect(optionsSource).toContain('cursorStyle: "bar" as const');
    expect(optionsSource).toContain('cursorInactiveStyle: "bar" as const');
    expect(optionsSource).not.toContain('cursorInactiveStyle: "outline" as const');
    expect(source).toContain("function applyCursorStyle");
    expect(source).toContain("slot.term.options.cursorInactiveStyle = \"bar\"");
    expect(source).toContain('intermediates: " ", final: "q"');
    expect(source).toContain("slot.term.parser.registerCsiHandler");
    expect(source).toContain("return true;");
  });

  it("does not reattach WebGL after context loss", () => {
    const source = readFileSync(rendererPoolPath, "utf8");

    expect(source).toContain("webglDisabledAfterContextLoss");
    expect(source).not.toContain("WEBGL_RECOVERY_DELAY_MS");
  });

  it("keeps WebGL opt-in so macOS IME input uses xterm's default renderer", () => {
    const source = readFileSync(settingsStorePath, "utf8");

    expect(source).toContain("terminalWebglEnabled: false");
  });

  it("keeps copy-on-select opt-in so terminal selection does not overwrite the clipboard by default", () => {
    const settingsSource = readFileSync(settingsStorePath, "utf8");
    const rendererSource = readFileSync(rendererPoolPath, "utf8");

    expect(settingsSource).toContain("terminalCopyOnSelection: false");
    expect(rendererSource).toContain("terminalCopyOnSelection");
  });

  it("overrides xterm's IME helper textarea positioning to be fixed", () => {
    const source = readFileSync(globalsCssPath, "utf8");

    expect(source).toContain(".xterm-helper-textarea");
    expect(source).toContain("position: fixed !important;");
  });

  it("removes xterm viewport and scrollable-element edge decorations", () => {
    const source = readFileSync(globalsCssPath, "utf8");

    expect(source).toContain("overflow: hidden !important;");
    expect(source).toContain(".xterm .xterm-scrollable-element");
    expect(source).toContain(".xterm .xterm-scrollable-element > .shadow");
    expect(source).toContain("overflow-y: hidden !important;");
    expect(source).toContain("scrollbar-gutter: auto !important;");
    expect(source).toContain(".cmdspace-terminal-viewport .xterm .xterm-viewport");
    expect(source).toContain(".cmdspace-terminal-viewport {");
    expect(source).toContain("background: var(--terminal-background);");
    expect(source).toContain("opacity: 0 !important;");
    expect(source).toContain("display: none !important;");
    expect(source).toContain("box-shadow: none !important;");
  });

  it("handles macOS native IME composition events through prefix-and-backspace matching", () => {
    const source = readFileSync(rendererPoolPath, "utf8");
    const imeSource = readFileSync(macImeBridgePath, "utf8");

    expect(source).toContain("attachMacImeBridge");
    expect(source).toContain("shouldUseMacTextInputPath");
    expect(imeSource).toContain("compositionstart");
    expect(imeSource).toContain("compositionend");
    expect(imeSource).toContain("commonPrefixLen");
    expect(imeSource).toContain("backspaces");
    expect(imeSource).toContain("writeDiff");
    expect(imeSource).toContain("IS_MAC_TEXT_INPUT_PLATFORM");
  });

  it("blocks both macOS printable keydown and keypress while the IME bridge owns text input", () => {
    const source = readFileSync(macImeBridgePath, "utf8");

    expect(source).toContain(
      'event.type !== "keydown" && event.type !== "keypress"',
    );
  });

  it("lets xterm own native paste while the IME bridge ignores its duplicate input event", () => {
    const source = readFileSync(rendererPoolPath, "utf8");
    const imeSource = readFileSync(macImeBridgePath, "utf8");

    expect(source).not.toContain("function isTerminalPaste");
    expect(source).not.toContain("navigator.clipboard\n          .readText()");
    expect(imeSource).toContain('input.inputType === "insertFromPaste"');
    expect(imeSource).toContain("lastValue = textarea.value;");
  });

  it("does not forward OSC 10/11 color reports as shell input", () => {
    const source = readFileSync(rendererPoolPath, "utf8");

    expect(source).toContain("const OSC_COLOR_REPORT");
    expect(source).toContain("if (OSC_COLOR_REPORT.test(data)) return;");
  });

  it("reports the visible shell command before forwarding Enter", () => {
    const source = readFileSync(rendererPoolPath, "utf8");

    expect(source).toContain("observeInputLine?(line: string): void;");
    expect(source).toContain("currentInputLine(slot.term)");
    expect(source).toContain("bridge.observeInputLine?.(currentInputLine(slot.term));");
  });

  it("can defer terminal fit work while app chrome is being resized", () => {
    const source = readFileSync(rendererPoolPath, "utf8");

    expect(source).toContain("let terminalResizePaused = false;");
    expect(source).toContain(
      "export function setTerminalResizePaused(paused: boolean): void",
    );
    expect(source).toContain("pendingResizeSlots.add(slot);");
    expect(source).toContain("fitSlotFromCurrentHost(slot);");
  });

  it("repaints the terminal canvas after a host resize even when dimensions are unchanged", () => {
    const source = readFileSync(rendererPoolPath, "utf8");

    expect(source).toContain("function refreshSlot(slot: Slot): void");
    expect(source).toContain("slot.term.refresh(0, Math.max(0, slot.term.rows - 1))");
    expect(source).toContain("fitSlot(slot);\n  refreshSlot(slot);");
  });

  it("debounces terminal selection auto-copy and skips repeated clipboard writes", () => {
    const source = readFileSync(rendererPoolPath, "utf8");

    expect(source).toContain("AUTO_COPY_SELECTION_DEBOUNCE_MS");
    expect(source).toContain("term.onSelectionChange");
    expect(source).toContain("slot.autoCopyTimer");
    expect(source).toContain("lastAutoCopiedSelection");
    expect(source).toContain("navigator.clipboard");
    expect(source).toContain(".writeText(selection)");
  });

  it("shows an inline copied badge after clipboard writes succeed", () => {
    const rendererSource = readFileSync(rendererPoolPath, "utf8");
    const cssSource = readFileSync(globalsCssPath, "utf8");

    expect(rendererSource).toContain("showAutoCopyBadge(slot)");
    expect(rendererSource).toContain('badge.textContent = "Copied"');
    expect(rendererSource).toContain('badge.setAttribute("role", "status")');
    expect(rendererSource).toContain('badge.setAttribute("aria-live", "polite")');
    expect(cssSource).toContain(".cmdspace-terminal-copy-badge");
    expect(cssSource).toContain(".cmdspace-terminal-copy-badge.is-visible");
  });

  it("clears only auto-copied selections after the clipboard write succeeds", () => {
    const source = readFileSync(rendererPoolPath, "utf8");

    expect(source).toContain("writeSelectionToClipboard(slot, selection, true)");
    expect(source).toContain("clearSelectionAfterCopy");
    expect(source).toContain("slot.term.clearSelection()");
  });

  it("intercepts a plain space once so it is not double-written on macOS (#125)", () => {
    const rendererSource = readFileSync(rendererPoolPath, "utf8");
    const imeSource = readFileSync(macImeBridgePath, "utf8");
    const canvasSource = readFileSync(canvasTerminalNodePath, "utf8");

    // The bridge exposes a plain-space predicate, and both terminal surfaces
    // (renderer pool + canvas node) must preventDefault and write it exactly
    // once instead of letting both the bridge input diff and xterm keypress
    // onData fire.
    expect(imeSource).toContain("export function isPlainSpaceKey");
    expect(rendererSource).toContain("isPlainSpaceKey(event)");
    expect(rendererSource).toContain('adapter?.resolveLeaf(leafId)?.writeToPty(" ")');
    expect(canvasSource).toContain("isPlainSpaceKey(event)");
    expect(canvasSource).toContain('sessionRef.current?.write(" ")');
  });

  it("force-clears a stuck IME composition so typing is not swallowed (#126)", () => {
    const source = readFileSync(macImeBridgePath, "utf8");

    // A compositionend that is never delivered must not leave `composing`
    // stuck, otherwise every following printable input is swallowed until the
    // next space/arrow key.
    expect(source).toContain("compositionStartTime");
    expect(source).toContain("COMPOSITION_WATCHDOG_MS");
    expect(source).toContain("staleComposition");
    expect(source).toContain('input.inputType !== "insertCompositionText"');
  });
});
