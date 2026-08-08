import { describe, expect, it } from "vitest";
import { matchBinding } from "./shortcuts";

describe("shortcut matching", () => {
  it("matches Cmd+> when WebKit reports the shifted period key code", () => {
    const event = {
      key: ".",
      code: "Period",
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
      metaKey: true,
    } as KeyboardEvent;

    expect(
      matchBinding(
        event,
        { key: ">", meta: true, shift: true },
        "pane.maximize",
      ),
    ).toBe(true);
  });

  it("matches Cmd+> when the dev webview omits shiftKey for Period", () => {
    const event = {
      key: ".",
      code: "Period",
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: true,
    } as KeyboardEvent;

    expect(
      matchBinding(
        event,
        { key: ">", meta: true, shift: true },
        "pane.maximize",
      ),
    ).toBe(true);
  });

  it("matches Cmd+> when Telex reports the physical key as Process", () => {
    const event = {
      key: "Process",
      code: "Period",
      keyCode: 229,
      isComposing: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: true,
    } as KeyboardEvent;

    expect(
      matchBinding(
        event,
        { key: ">", meta: true, shift: true },
        "pane.maximize",
      ),
    ).toBe(true);
  });
});
