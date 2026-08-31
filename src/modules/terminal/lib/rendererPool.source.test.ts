import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const rendererPoolPath = path.join(here, "rendererPool.ts");
const rendererWebglPath = path.join(here, "rendererWebgl.ts");
const rendererInputPath = path.join(here, "rendererInput.ts");
const rendererPreferencesPath = path.join(here, "rendererPreferences.ts");
const rendererResizePath = path.join(here, "rendererResize.ts");

function readRendererSource() {
  return [
    readFileSync(rendererPoolPath, "utf8"),
    readFileSync(rendererWebglPath, "utf8"),
    readFileSync(rendererInputPath, "utf8"),
    readFileSync(rendererPreferencesPath, "utf8"),
    readFileSync(rendererResizePath, "utf8"),
  ].join("\n");
}
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
    const source = readRendererSource();

    expect(source).toContain("POOL_MAX_SIZE = 12");
  });

  it("uses a vertical cursor in both focused and inactive panes", () => {
    const source = readRendererSource();
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
    const source = readRendererSource();

    expect(source).toContain("webglDisabledAfterContextLoss");
    expect(source).not.toContain("WEBGL_RECOVERY_DELAY_MS");
  });

  it("keeps WebGL opt-in so macOS IME input uses xterm's default renderer", () => {
    const source = readFileSync(settingsStorePath, "utf8");

    expect(source).toContain("terminalWebglEnabled: false");
  });

  it("keeps copy-on-select opt-in so terminal selection does not overwrite the clipboard by default", () => {
    const settingsSource = readFileSync(settingsStorePath, "utf8");
    const rendererSource = readRendererSource();

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

  it("leaves macOS IME composition to xterm's native input path", () => {
    const source = readRendererSource();
    const imeSource = readFileSync(macImeBridgePath, "utf8");

    expect(source).not.toContain("attachMacImeBridge");
    expect(source).not.toContain("createMacTextInputDeduplicator");
    expect(source).not.toContain("shouldUseMacTextInputPath");
    expect(source).not.toContain("shouldIgnoreMacPrintableTerminalData");
    expect(imeSource).not.toContain("stopImmediatePropagation");
    expect(imeSource).toContain("IS_MAC_TEXT_INPUT_PLATFORM");
    expect(source).toContain("bridge.writeToPty(normalized);");
  });

  it("lets xterm own native paste and text input", () => {
    const source = readRendererSource();

    expect(source).not.toContain("function isTerminalPaste");
    expect(source).not.toContain("navigator.clipboard\n          .readText()");
  });

  it("routes a plain space once through xterm's native onData callback", () => {
    const rendererSource = readRendererSource();
    const canvasSource = readFileSync(canvasTerminalNodePath, "utf8");

    expect(rendererSource).not.toContain("isPlainSpaceKey(event)");
    expect(canvasSource).not.toContain("isPlainSpaceKey(event)");
    expect(rendererSource).toContain("bridge.writeToPty(normalized);");
    expect(canvasSource).toContain("sessionRef.current?.write(normalized)");
  });

  it("clears the entire prompt with Cmd+Shift+Delete", () => {
    const source = readRendererSource();

    expect(source).toContain("terminalEditingSequence(event, IS_MAC)");
    expect(source).toContain("bridge.writeToPty(editingSequence)");
  });

  it("filters a duplicate xterm commit only during composition finalization", () => {
    const rendererSource = readRendererSource();
    const canvasSource = readFileSync(canvasTerminalNodePath, "utf8");

    expect(rendererSource).toContain("createMacCompositionCommitFilter");
    expect(rendererSource).toContain("addEventListener(");
    expect(rendererSource).toContain('"compositionend"');
    expect(rendererSource).toContain("event.metaKey");
    expect(rendererSource).toContain(
      "compositionCommitFilter.beginKeydownFinalization();",
    );
    expect(rendererSource).toContain(
      "compositionCommitFilter.handleWindowBlur",
    );
    expect(rendererSource).toContain(
      "compositionCommitFilter.handleWindowFocus",
    );
    expect(rendererSource).toContain("compositionCommitFilter.shouldForward(normalized)");
    expect(canvasSource).toContain("createMacCompositionCommitFilter");
    expect(canvasSource).toContain("addEventListener(");
    expect(canvasSource).toContain('"compositionend"');
    expect(canvasSource).toContain(
      "compositionCommitFilter.beginKeydownFinalization();",
    );
    expect(canvasSource).toContain(
      "compositionCommitFilter.handleWindowBlur",
    );
    expect(canvasSource).toContain(
      "compositionCommitFilter.handleWindowFocus",
    );
    expect(canvasSource).toContain("compositionCommitFilter.shouldForward(normalized)");
  });
});
