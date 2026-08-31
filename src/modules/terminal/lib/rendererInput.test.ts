import { afterEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { traceTerminalInput } from "./terminal-native";
import { configureRendererInput } from "./rendererInput";

vi.mock("./terminal-native", () => ({
  traceTerminalInput: vi.fn(() => Promise.resolve()),
}));

type SelectionListener = () => void;
type DataListener = (data: string) => void;
type CustomKeyHandler = (event: KeyboardEvent) => boolean;

function createSlot(selection: () => string) {
  let onSelectionChange: SelectionListener | undefined;
  let onData: DataListener | undefined;
  let onCustomKeyEvent: CustomKeyHandler | undefined;
  const badge = {
    className: "",
    textContent: "",
    setAttribute: vi.fn(),
    classList: { add: vi.fn(), remove: vi.fn() },
  };
  const host = {
    ownerDocument: { defaultView: { addEventListener: vi.fn() } },
    appendChild: vi.fn(),
  };
  const slot = {
    currentLeafId: 42,
    autoCopyTimer: null,
    copyBadgeTimer: null,
    copyBadge: null,
    lastAutoCopiedSelection: "",
    host,
    term: {
      textarea: undefined,
      attachCustomKeyEventHandler: vi.fn((handler: CustomKeyHandler) => {
        onCustomKeyEvent = handler;
      }),
      onData: vi.fn((listener: DataListener) => {
        onData = listener;
      }),
      onSelectionChange: vi.fn((listener: SelectionListener) => {
        onSelectionChange = listener;
      }),
      getSelection: vi.fn(selection),
      hasSelection: vi.fn(() => true),
      clearSelection: vi.fn(),
      buffer: {
        active: {
          baseY: 0,
          cursorY: 0,
          getLine: vi.fn(() => ({ translateToString: () => "git status" })),
        },
      },
    },
  };
  return {
    slot,
    badge,
    triggerSelection: () => onSelectionChange?.(),
    triggerData: (data: string) => onData?.(data),
    triggerKey: (event: KeyboardEvent) => onCustomKeyEvent?.(event),
  };
}

const previousCopyOnSelection = usePreferencesStore.getState().terminalCopyOnSelection;

afterEach(() => {
  usePreferencesStore.setState({
    terminalCopyOnSelection: previousCopyOnSelection,
  });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("rendererInput selection copy", () => {
  it("debounces a copied selection, clears it only after clipboard success, and avoids duplicate writes", async () => {
    vi.useFakeTimers();
    usePreferencesStore.setState({ terminalCopyOnSelection: true });
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { userAgent: "Linux", clipboard: { writeText } });
    const { slot, badge, triggerSelection } = createSlot(() => "selected output");
    vi.stubGlobal("document", { createElement: vi.fn(() => badge) });

    configureRendererInput(slot as never, { resolveLeaf: vi.fn(() => null) });
    triggerSelection();
    vi.advanceTimersByTime(120);
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("selected output");
    expect(slot.term.clearSelection).toHaveBeenCalledOnce();
    expect(slot.host.appendChild).toHaveBeenCalledWith(badge);
    expect(badge.setAttribute).toHaveBeenCalledWith("role", "status");
    expect(badge.setAttribute).toHaveBeenCalledWith("aria-live", "polite");
    expect(badge.classList.add).toHaveBeenCalledWith("is-visible");

    triggerSelection();
    vi.advanceTimersByTime(120);
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledOnce();
  });

  it("keeps the selection when the clipboard write fails", async () => {
    vi.useFakeTimers();
    usePreferencesStore.setState({ terminalCopyOnSelection: true });
    const writeText = vi.fn(() => Promise.reject(new Error("clipboard unavailable")));
    vi.stubGlobal("navigator", { userAgent: "Linux", clipboard: { writeText } });
    const { slot, triggerSelection } = createSlot(() => "selected output");

    configureRendererInput(slot as never, { resolveLeaf: vi.fn(() => null) });
    triggerSelection();
    vi.advanceTimersByTime(120);
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("selected output");
    expect(slot.term.clearSelection).not.toHaveBeenCalled();
  });

  it("drops an xterm OSC color report instead of forwarding it to the shell", () => {
    const { slot, triggerData } = createSlot(() => "");
    const writeToPty = vi.fn();

    configureRendererInput(slot as never, {
      resolveLeaf: vi.fn(() => ({ writeToPty, resizePty: vi.fn(), kickPty: vi.fn() })),
    });
    triggerData("\x1b]10;rgb:0000/0000/0000\x1b\\");

    expect(writeToPty).not.toHaveBeenCalled();
  });

  it("reports the visible prompt line before forwarding Enter to the PTY", () => {
    const { slot, triggerData } = createSlot(() => "");
    const observeInputLine = vi.fn();
    const writeToPty = vi.fn();

    configureRendererInput(slot as never, {
      resolveLeaf: vi.fn(() => ({
        writeToPty,
        observeInputLine,
        resizePty: vi.fn(),
        kickPty: vi.fn(),
      })),
    });
    triggerData("git status\r");

    expect(observeInputLine).toHaveBeenCalledWith("git status");
    expect(writeToPty).toHaveBeenCalledWith("git status\r");
    expect(observeInputLine.mock.invocationCallOrder[0]).toBeLessThan(
      writeToPty.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(traceTerminalInput).toHaveBeenCalledWith("xterm-ondata", "git status\r");
  });

  it("forwards Cmd+Shift+Arrow as a readline line-boundary sequence before pane navigation", () => {
    const { slot, triggerKey } = createSlot(() => "");
    const writeToPty = vi.fn();
    const preventDefault = vi.fn();

    configureRendererInput(slot as never, {
      resolveLeaf: vi.fn(() => ({ writeToPty, resizePty: vi.fn(), kickPty: vi.fn() })),
    });
    const handled = triggerKey({
      type: "keydown",
      key: "ArrowLeft",
      code: "ArrowLeft",
      metaKey: true,
      shiftKey: true,
      ctrlKey: false,
      altKey: false,
      isComposing: false,
      keyCode: 0,
      preventDefault,
    } as unknown as KeyboardEvent);

    expect(handled).toBe(false);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(writeToPty).toHaveBeenCalledWith("\x01");
  });
});
