import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("macOS IME composition rendering", () => {
  it("lets xterm observe composition updates for immediate preedit rendering", async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { userAgent: "MacIntel" });

    const { attachMacImeBridge, IS_MAC_TEXT_INPUT_PLATFORM } =
      await import("./macImeBridge");
    expect(IS_MAC_TEXT_INPUT_PLATFORM).toBe(true);
    const listeners: Array<{
      type: string;
      capture: boolean;
      listener: (event: Event) => void;
    }> = [];
    type TestTextarea = {
      value: string;
      addEventListener: (
        type: string,
        listener: (event: Event) => void,
        options?: boolean | AddEventListenerOptions,
      ) => void;
      dispatchCompositionUpdate: () => void;
    };
    const textarea: TestTextarea = {
      value: "",
      addEventListener(
        type: string,
        listener: (event: Event) => void,
        options?: boolean | AddEventListenerOptions,
      ) {
        listeners.push({
          type,
          capture: typeof options === "boolean" ? options : Boolean(options?.capture),
          listener,
        });
      },
      dispatchCompositionUpdate() {
        let stopped = false;
        const event = {
          type: "compositionupdate",
          stopImmediatePropagation: () => {
            stopped = true;
          },
        } as unknown as Event;
        for (const phase of [true, false]) {
          for (const entry of listeners) {
            if (!stopped && entry.type === event.type && entry.capture === phase) {
              entry.listener(event);
            }
          }
        }
      },
    };
    let xtermSawUpdate = false;
    textarea.addEventListener("compositionupdate", () => {
      xtermSawUpdate = true;
    });

    attachMacImeBridge(
      { textarea } as never,
      () => undefined,
    );
    textarea.dispatchCompositionUpdate();

    expect(xtermSawUpdate).toBe(true);
  });
});
