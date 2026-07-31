import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const source = readFileSync(path.join(here, "BottomTerminalDrawer.tsx"), "utf8");

describe("BottomTerminalDrawer", () => {
  it("owns an isolated PTY and releases it when the drawer closes", () => {
    expect(source).toContain("openPty(80, 24, handlers, initialCwdRef.current)");
    expect(source).toContain("if (session) void session.close();");
    expect(source).toContain("sharedTerminalOptions()");
    expect(source).toContain("attachMacImeBridge");
    expect(source).toContain("shouldIgnoreMacPrintableTerminalData");
  });

  it("focuses on demand and exposes a smooth vertical resize handle", () => {
    expect(source).toContain("focus: () => terminalRef.current?.focus()");
    expect(source).toContain('aria-label="Resize bottom terminal"');
    expect(source).toContain("cursor-row-resize");
    expect(source).toContain("requestAnimationFrame(flushResize)");
    expect(source).toContain("new ResizeObserver(scheduleFit)");
    expect(source).not.toContain("rounded-xl");
    expect(source).toContain("shadow-[0_-16px_36px_-18px_rgba(0,0,0,0.45)]");
  });

  it("shares the standard folder and branch controls with its isolated PTY", () => {
    expect(source).toContain("TerminalNavigationControls");
    expect(source).toContain("onChangeDirectory={changeDirectory}");
    expect(source).toContain("setCwd(nextCwd)");
    expect(source).toContain("write(`cd ${shellQuote(path)}\\r`)");
  });
});
