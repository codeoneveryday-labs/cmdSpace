import { describe, expect, it, vi } from "vitest";
import type { Terminal } from "@xterm/xterm";
import {
  createShellIntegrationState,
  registerCwdHandler,
  registerPromptTracker,
} from "./osc-handlers";

/**
 * Minimal in-memory fake of the xterm `Terminal` surface we touch — just
 * enough to register OSC handlers and invoke them with crafted payloads.
 * The OSC handler signature is `(data: string) => boolean | Promise<boolean>`.
 */
type OscHandler = (data: string) => boolean | Promise<boolean>;

function makeFakeTerm() {
  const handlers = new Map<number, OscHandler>();
  const term = {
    parser: {
      registerOscHandler(code: number, handler: OscHandler) {
        handlers.set(code, handler);
        return { dispose: () => handlers.delete(code) };
      },
    },
    registerMarker: vi.fn().mockReturnValue({ isDisposed: false, dispose: vi.fn() }),
  } as unknown as Terminal;
  return { term, handlers };
}

describe("OSC 7 cwd handler — gated by OSC 133 in-command state", () => {
  it("accepts OSC 7 when no command is running", () => {
    const { term, handlers } = makeFakeTerm();
    const state = createShellIntegrationState();
    const onCwd = vi.fn();
    registerPromptTracker(term, state);
    registerCwdHandler(term, onCwd, state);

    // OSC 133 A means "new prompt is about to be drawn" — we're between
    // commands and OSC 7 from the shell is legitimate here.
    handlers.get(133)?.("A");
    handlers.get(7)?.("file://host/home/me/project");

    expect(onCwd).toHaveBeenCalledWith("/home/me/project");
  });

  it("rejects OSC 7 emitted while a command is running", () => {
    const { term, handlers } = makeFakeTerm();
    const state = createShellIntegrationState();
    const onCwd = vi.fn();
    registerPromptTracker(term, state);
    registerCwdHandler(term, onCwd, state);

    // Simulate: user runs `ssh attacker.host`, which prints attacker bytes
    // including an OSC 7 trying to silently move the AI's cwd into /etc.
    handlers.get(133)?.("A"); // prompt drawn
    handlers.get(133)?.("B"); // prompt boundary; still editable
    handlers.get(133)?.("C"); // command begins (user hit enter)
    handlers.get(7)?.("file://host/etc"); // attacker injection

    expect(onCwd).not.toHaveBeenCalled();
  });

  it("re-accepts OSC 7 after command finishes (OSC 133 D)", () => {
    const { term, handlers } = makeFakeTerm();
    const state = createShellIntegrationState();
    const onCwd = vi.fn();
    registerPromptTracker(term, state);
    registerCwdHandler(term, onCwd, state);

    handlers.get(133)?.("A");
    handlers.get(133)?.("B"); // prompt boundary
    handlers.get(133)?.("C"); // running
    handlers.get(7)?.("file://host/etc"); // blocked
    handlers.get(133)?.("D;0"); // command exited
    handlers.get(7)?.("file://host/home/me/new-cwd"); // legitimate post-cmd OSC 7

    expect(onCwd).toHaveBeenCalledTimes(1);
    expect(onCwd).toHaveBeenCalledWith("/home/me/new-cwd");
  });

  it("works without state for backwards compatibility (legacy callers)", () => {
    // The state parameter is optional — when omitted, OSC 7 is always
    // honored (legacy behavior). Tests must confirm we didn't break this.
    const { term, handlers } = makeFakeTerm();
    const onCwd = vi.fn();
    registerCwdHandler(term, onCwd);

    handlers.get(7)?.("file://host/home/me/project");
    expect(onCwd).toHaveBeenCalledWith("/home/me/project");
  });

  it("normalizes Windows drive-letter OSC 7 paths", () => {
    const { term, handlers } = makeFakeTerm();
    const onCwd = vi.fn();
    registerCwdHandler(term, onCwd);

    handlers.get(7)?.("file:///C:/Users/me/project");
    expect(onCwd).toHaveBeenCalledWith("C:/Users/me/project");
  });

  it("decodes percent-encoded Windows drive-letter OSC 7 paths and strips the synthetic leading slash", () => {
    const { term, handlers } = makeFakeTerm();
    const onCwd = vi.fn();
    registerCwdHandler(term, onCwd);

    handlers.get(7)?.("file://host/D:/Users/me/My%20Project");
    expect(onCwd).toHaveBeenCalledWith("D:/Users/me/My Project");
  });

  it("notifies when a new prompt marker is received", () => {
    const { term, handlers } = makeFakeTerm();
    const onPrompt = vi.fn();
    registerPromptTracker(term, undefined, onPrompt);

    handlers.get(133)?.("A");
    handlers.get(133)?.("B");

    expect(onPrompt).toHaveBeenCalledTimes(1);
  });

  it("keeps the prompt editable after OSC 133 B", () => {
    const { term, handlers } = makeFakeTerm();
    const state = createShellIntegrationState();
    registerPromptTracker(term, state);

    handlers.get(133)?.("B");

    expect(state.inCommand).toBe(false);
    handlers.get(133)?.("C");
    expect(state.inCommand).toBe(true);
  });

  it("increments commandCount on OSC 133 C and preserves it on prompt", () => {
    const { term, handlers } = makeFakeTerm();
    const state = createShellIntegrationState();
    registerPromptTracker(term, state);

    expect(state.commandCount).toBe(0);

    // Initial prompt before any command
    handlers.get(133)?.("A");
    expect(state.commandCount).toBe(0);

    // Command starts
    handlers.get(133)?.("C");
    expect(state.commandCount).toBe(1);
    expect(state.inCommand).toBe(true);

    // Command ends and prompt returns
    handlers.get(133)?.("D;0");
    handlers.get(133)?.("A");
    expect(state.commandCount).toBe(1);
    expect(state.inCommand).toBe(false);
  });
});
