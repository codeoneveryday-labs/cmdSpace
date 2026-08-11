import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const useTerminalSessionPath = path.join(here, "useTerminalSession.ts");
const terminalPanePath = path.join(here, "../TerminalPane.tsx");
const canvasTerminalNodePath = path.join(
  here,
  "../../architecture/CanvasTerminalNode.tsx",
);

describe("useTerminalSession PTY lifecycle boundaries", () => {
  it("detaches pane sessions by releasing the slot and clearing live visibility state", () => {
    const source = readFileSync(useTerminalSessionPath, "utf8");

    expect(source).toContain("function detachSession(leafId: number): void");
    expect(source).toContain("unbindLeafFromSlot(leafId, s);");
    expect(source).toContain("s.visibleNow = false;");
    expect(source).toContain("s.focusedNow = false;");
    expect(source).toContain("s.callbacks = {};");
    expect(source).toContain("s.container = null;");
  });

  it("captures slot snapshot state on detach and replays it on rebind", () => {
    const source = readFileSync(useTerminalSessionPath, "utf8");

    expect(source).toContain("function unbindLeafFromSlot(leafId: number, s: Session): void");
    expect(source).toContain("const out = releaseSlot(leafId);");
    expect(source).toContain("s.snapshot = out.snapshot;");
    expect(source).toContain("if (out.cols > 0) s.cols = out.cols;");
    expect(source).toContain("if (out.rows > 0) s.rows = out.rows;");
    expect(source).toContain("s.altScreenAtRelease = out.altScreen;");
    expect(source).toContain("s.shellState = null;");

    expect(source).toContain("function bindLeafToSlot(leafId: number, s: Session): void");
    expect(source).toContain("const altScreen = s.altScreenAtRelease;");
    expect(source).toContain("s.altScreenAtRelease = false;");
    expect(source).toContain("snapshot: s.snapshot,");
    expect(source).toContain("altScreen,");
    expect(source).toContain("drainRing: (write) => s.dormantRing.drain(write),");
    expect(source).toContain("shellExited: s.shellExited,");
    expect(source).toContain("searchQuery: s.searchQuery,");
    expect(source).toContain("cols: s.cols,");
    expect(source).toContain("rows: s.rows,");
    expect(source).toContain("s.snapshot = null;");
    expect(source).toContain("if (s.lastCwd !== null) s.callbacks.onCwd?.(s.lastCwd);");
    expect(source).toContain("if (s.pendingExit !== null) {");
  });

  it("only rebinds a detached pane when the live pane surface is visible again", () => {
    const source = readFileSync(useTerminalSessionPath, "utf8");
    const terminalPaneSource = readFileSync(terminalPanePath, "utf8");

    expect(source).toContain("if (s.visibleNow) bindLeafToSlot(leafId, s);");
    expect(source).toContain("if (visible) {");
    expect(source).toContain("if (s.container && !s.hasSlot) bindLeafToSlot(leafId, s);");
    expect(source).toContain("setSlotFocused(leafId, focused);");
    expect(source).toContain("setSlotFocused(leafId, false);");

    expect(terminalPaneSource).toContain("style={{");
    expect(terminalPaneSource).toContain('visibility: visible ? "visible" : "hidden"');
    expect(terminalPaneSource).toContain('pointerEvents: visible ? "auto" : "none"');
  });

  it("keeps canvas terminals on their direct PTY path instead of the pane session lifecycle", () => {
    const source = readFileSync(useTerminalSessionPath, "utf8");
    const canvasSource = readFileSync(canvasTerminalNodePath, "utf8");

    expect(source).not.toContain("CanvasTerminalNode");
    expect(canvasSource).toContain(
      'import {\n  openPty,\n  type PtyHandlers,\n  type PtySession,\n} from "@/modules/terminal/lib/pty-bridge";',
    );
    expect(canvasSource).not.toContain("useTerminalSession");
    expect(canvasSource).not.toContain("TerminalPane");
    expect(canvasSource).not.toContain("acquireSlot(");
    expect(canvasSource).not.toContain("releaseSlot(");
    expect(canvasSource).toContain("sessionRef.current = session;");
    expect(canvasSource).toContain("sessionRef.current = null;");
    expect(canvasSource).toContain("void sessionRef.current?.write(normalized);");
  });
});
