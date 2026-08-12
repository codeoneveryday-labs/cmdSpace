import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);

describe("RemoteTerminal renderer", () => {
  it("uses WebGL only on precise-pointer devices and keeps a mobile-safe renderer", () => {
    const source = readFileSync(path.join(here, "RemoteTerminal.tsx"), "utf8");

    expect(source).toContain("WebglAddon");
    expect(source).toContain('matchMedia("(pointer: fine)")');
    expect(source).toContain("if (useWebgl)");
    expect(source).toContain("onContextLoss");
    expect(source).toContain("client.subscribeTerminal");
    expect(source.match(/new ResizeObserver/g)).toHaveLength(1);
    expect(source).toContain("lastSize");
    expect(source).not.toContain('window.addEventListener("resize"');
    expect(source).not.toContain("new WebSocket");
  });

  it("accepts hardware and system keyboard input directly in the terminal", () => {
    const source = readFileSync(path.join(here, "RemoteTerminal.tsx"), "utf8");

    expect(source).toContain("disableStdin: false");
    expect(source).toContain("convertEol: true");
    expect(source).toContain("terminal.onData((data) => client.sendInput(sessionId, data))");
    expect(source).not.toContain("focusRequest");
    expect(source).toContain("terminal.write(data)");
    expect(source).not.toContain("TerminalOutputQueue");
  });

  it("does not stretch xterm's calculated screen to the full viewport", () => {
    const css = readFileSync(path.join(here, "remote.css"), "utf8");

    expect(css).not.toContain(".remote-terminal .xterm-screen");
  });

  it("keeps xterm's helper textarea in a fixed WebKit IME context", () => {
    const css = readFileSync(path.join(here, "remote.css"), "utf8");

    expect(css).toContain(".remote-terminal .xterm-helper-textarea {");
    expect(css).toContain("position: fixed !important;");
    expect(css).not.toContain("left: 0 !important;");
    expect(css).not.toContain("z-index: -1 !important;");
  });

  it("uses clsh's font-ready lifecycle before opening and fitting xterm", () => {
    const source = readFileSync(path.join(here, "RemoteTerminal.tsx"), "utf8");

    expect(source.indexOf("await document.fonts")).toBeLessThan(source.indexOf("terminal.open(container)"));
    expect(source).toContain("queueMicrotask(fitAndResize)");
  });

  it("does not inherit the desktop xterm overrides", () => {
    const entry = readFileSync(path.join(here, "main.tsx"), "utf8");

    expect(entry).not.toContain("../styles/globals.css");
  });
});
