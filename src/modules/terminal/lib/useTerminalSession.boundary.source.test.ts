import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const useTerminalSessionPath = path.join(here, "useTerminalSession.ts");
const terminalSessionRuntimePath = path.join(here, "terminalSessionRuntime.ts");
const terminalSessionLifecyclePath = path.join(here, "useTerminalSessionLifecycle.ts");
const terminalInputTrackingPath = path.join(here, "terminalInputTrackingModel.ts");
const terminalOutputModelPath = path.join(here, "terminalOutputModel.ts");
const terminalPanePath = path.join(here, "../TerminalPane.tsx");
const canvasTerminalNodePath = path.join(
  here,
  "../../architecture/CanvasTerminalNode.tsx",
);
const terminalWakeRebindPath = path.join(here, "terminalWakeRebind.ts");
const terminalSessionModelPath = path.join(here, "terminalSessionModel.ts");
const terminalSessionRuntimeModelPath = path.join(here, "terminalSessionRuntimeModel.ts");
const terminalSessionVisibilityModelPath = path.join(here, "terminalSessionVisibilityModel.ts");
const terminalSessionAttachmentPath = path.join(here, "terminalSessionAttachment.ts");

function readSessionSource() {
  return [
    readFileSync(useTerminalSessionPath, "utf8"),
    readFileSync(terminalSessionLifecyclePath, "utf8"),
    readFileSync(terminalSessionRuntimePath, "utf8"),
    readFileSync(terminalSessionModelPath, "utf8"),
    readFileSync(terminalSessionRuntimeModelPath, "utf8"),
    readFileSync(terminalSessionVisibilityModelPath, "utf8"),
    readFileSync(terminalSessionAttachmentPath, "utf8"),
  ].join("\n");
}

describe("useTerminalSession PTY lifecycle boundaries", () => {
  it("detaches pane sessions by releasing the slot and clearing live visibility state", () => {
    const source = readSessionSource();

    expect(source).toContain("function detachSession(leafId: number): void");
    expect(source).toContain("detachTerminalSession({ leafId, session: s, releaseSlot });");
    expect(source).toContain("session.visibleNow = false;");
    expect(source).toContain("session.focusedNow = false;");
    expect(source).toContain("session.callbacks = {};");
    expect(source).toContain("session.container = null;");
  });

  it("captures slot snapshot state on detach and replays it on rebind", () => {
    const source = readSessionSource();

    expect(source).toContain("unbindTerminalSessionFromSlot");
    expect(source).toContain("const released = releaseSlot(leafId);");
    expect(source).toContain("session.snapshot = released.snapshot;");
    expect(source).toContain("if (released.cols > 0) session.cols = released.cols;");
    expect(source).toContain("if (released.rows > 0) session.rows = released.rows;");
    expect(source).toContain("session.altScreenAtRelease = released.altScreen;");
    expect(source).toContain("session.shellState = null;");

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
    const source = readSessionSource();
    const terminalPaneSource = readFileSync(terminalPanePath, "utf8");

    expect(source).toContain("if (s.visibleNow) bindLeafToSlot(leafId, s);");
    expect(source).toContain("if (visible) {");
    expect(source).toContain(
      "if (session.container && !session.hasSlot) bindLeafToSlot(leafId, session);",
    );
    expect(source).toContain("setSlotFocused(leafId, focused);");
    expect(source).toContain("setSlotFocused(leafId, false);");

    expect(terminalPaneSource).toContain("style={{");
    expect(terminalPaneSource).toContain('visibility: visible ? "visible" : "hidden"');
    expect(terminalPaneSource).toContain('pointerEvents: visible ? "auto" : "none"');
  });

  it("rebinds visible leaves when the window returns from hibernation", () => {
    const source = [
      readSessionSource(),
      readFileSync(terminalWakeRebindPath, "utf8"),
    ].join("\n");

    expect(source).toContain("installTerminalWakeRebind");
    expect(source).toContain('document.addEventListener("visibilitychange"');
    expect(source).toContain('document.visibilityState === "visible"');
    expect(source).toContain('window.addEventListener("focus", rebindVisibleLeaves)');
    expect(source).toContain(
      "!session.visibleNow || session.hasSlot || !session.container",
    );
    expect(source).toContain("bindLeafToSlot(leafId, s)");
  });

  it("keeps canvas terminals on their direct PTY path instead of the pane session lifecycle", () => {
    const source = readSessionSource();
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

  it("broadcasts only xterm user input and leaves imperative writes direct", () => {
    const source = readSessionSource();

    expect(source).toContain("broadcastTargetsForInput(");
    expect(source).toContain("[...sessions.keys()]");
    expect(source).toContain("const write = useCallback((data: string) => {");
    expect(source).toContain("if (s) writeToSessionPty(leafId, s, data);");
  });

  it("keeps the selected directory for later retries after a respawn", () => {
    const source = readSessionSource();

    expect(source).toContain("if (cwd !== undefined) session.initialCwd = cwd;");
    expect(source).toContain("if (previousPty) await previousPty.close();");
    expect(source).toContain("openPtyForSession(leafId, s, cwd ?? s.initialCwd)");
  });

  it("relaunches the original agent only for an explicit directory relocation", () => {
    const source = readSessionSource();

    expect(source).toContain("launchCommand: string | undefined;");
    expect(source).toContain("launchCommand: initialCommand,");
    expect(source).toContain(
      "session.initialCommand = relaunchInitialCommand",
    );
  });

  it("remembers agents launched interactively so directory relocation can reopen them", () => {
    const source = [
      readSessionSource(),
      readFileSync(terminalInputTrackingPath, "utf8"),
      readFileSync(terminalOutputModelPath, "utf8"),
    ].join("\n");

    expect(source).toContain("s.launchCommand = event.command;");
    expect(source).toContain("s.launchCommand = outputResult.state.launchCommand;");
  });

  it("publishes output activity and clears its timer on exit and disposal", () => {
    const source = readSessionSource();

    expect(source).toContain("noteTerminalOutput(Date.now(), OUTPUT_ACTIVITY_QUIET_MS)");
    expect(source).toContain("s.callbacks.onOutputActivity?.(outputActivity.active)");
    expect(source).toContain("window.clearTimeout(s.outputActivityTimer)");
    expect(source).toContain("s.callbacks.onOutputActivity?.(false)");
  });
});
